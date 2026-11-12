//! Runners and their jobs: who stopped reporting, what started, what finished and how.

use super::FinishedJob;
use crate::reading::{JobLine, Reading};
use std::collections::{BTreeMap, BTreeSet, VecDeque};

/// A finished job waits this many polls for its result before it is logged without one.
const RESULT_POLLS: u32 = 4;
/// Result logs remembered, so one result is never used twice.
const USED_LOGS: usize = 300;
/// Branch names longer than this are cut.
const BRANCH_MAX: usize = 44;
/// Seconds in a minute.
const MINUTE_S: i64 = 60;
/// Half a minute, for rounding.
const HALF_MINUTE_S: i64 = 30;
/// What a job with no details is called.
const BUSY: &str = "busy";
const PULL_PREFIX: &str = "refs/pull/";
const BRANCH_PREFIX: &str = "refs/heads/";

/// 'PR #744 · branch-name · Fast check (repo)'.
fn label(j: &JobLine) -> String {
    let mut what = Vec::new();
    let pr = j
        .git_ref
        .strip_prefix(PULL_PREFIX)
        .and_then(|r| r.split_once('/'));
    if let Some((n, _)) = pr.filter(|(n, _)| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
    {
        what.push(format!("PR #{n}"));
    }
    let branch = if j.head_ref.is_empty() {
        j.git_ref.replace(BRANCH_PREFIX, "")
    } else {
        j.head_ref.clone()
    };
    if branch.chars().count() > BRANCH_MAX {
        what.push(branch.chars().take(BRANCH_MAX - 1).chain(['…']).collect());
    } else if !branch.is_empty() {
        what.push(branch);
    }
    if !j.name.is_empty() {
        what.push(j.name.clone());
    }
    let repo = j.repo.rsplit('/').next().filter(|r| !r.is_empty());
    if what.is_empty() && repo.is_none() {
        return BUSY.to_owned();
    }
    let repo = repo.map(|r| format!(" ({r})")).unwrap_or_default();
    format!("{}{repo}", what.join(" · "))
}

struct Waiting {
    start: i64,
    label: String,
    polls: u32,
}

#[derive(Default)]
pub(super) struct Runners {
    machine: String,
    seen: BTreeSet<String>,
    pub(super) gone: BTreeSet<String>,
    previous: BTreeMap<String, String>,
    pub(super) started: BTreeMap<String, i64>,
    primed: bool,
    waiting: BTreeMap<String, Waiting>,
    used_logs: VecDeque<String>,
    pub(super) finished: Vec<FinishedJob>,
}

impl Runners {
    pub(super) fn new(machine: &str) -> Self {
        Self {
            machine: machine.to_owned(),
            ..Self::default()
        }
    }

    pub(super) fn observe(&mut self, r: &Reading, now: i64) -> Vec<String> {
        let mut say = Vec::new();
        let present: BTreeSet<&str> = r.runners.iter().map(|x| x.name.as_str()).collect();
        self.seen.extend(r.runners.iter().map(|x| x.name.clone()));
        for n in &self.seen {
            if !present.contains(n.as_str()) && self.gone.insert(n.clone()) {
                say.push(format!("runner {n} gone"));
            } else if present.contains(n.as_str()) && self.gone.remove(n) {
                say.push(format!("runner {n} back"));
            }
        }
        let running: BTreeMap<String, String> = r
            .jobs
            .iter()
            .filter(|j| j.is_running())
            .map(|j| (j.runner.clone(), label(j)))
            .collect();
        if !self.primed {
            // First answer after a restart: jobs already running are not new.
            self.primed = true;
            self.previous.clone_from(&running);
            self.started
                .extend(running.keys().map(|n| (n.clone(), now)));
        }
        for (n, text) in running
            .iter()
            .filter(|(n, _)| !self.previous.contains_key(*n))
        {
            say.push(format!("{n} started: {text}"));
            self.started.insert(n.clone(), now);
        }
        for (n, text) in self
            .previous
            .iter()
            .filter(|(n, _)| !running.contains_key(*n))
        {
            let start = self.started.remove(n).unwrap_or(now);
            let waiting = Waiting {
                start,
                label: text.clone(),
                polls: 0,
            };
            self.waiting.insert(n.clone(), waiting);
        }
        self.previous = running;
        say.extend(self.results(r, now));
        say
    }

    /// A result shows up in the runner's log a moment after the job ends: log the
    /// finish with it, or without it after a few polls.
    fn results(&mut self, r: &Reading, now: i64) -> Vec<String> {
        let mut say = Vec::new();
        let mut done = Vec::new();
        for (n, w) in &mut self.waiting {
            w.polls += 1;
            let res = r.jobs.iter().find(|j| &j.runner == n).and_then(|j| {
                let log = j.result_log.clone().unwrap_or_default();
                if self.used_logs.contains(&log) {
                    return None;
                }
                Some((j.result.clone()?, log))
            });
            let result = match res {
                Some((result, log)) => {
                    self.used_logs.push_back(log);
                    result
                }
                None if w.polls >= RESULT_POLLS => String::new(),
                None => continue,
            };
            let minutes = (now - w.start + HALF_MINUTE_S) / MINUTE_S;
            let how = if result.is_empty() {
                String::new()
            } else {
                format!(", {result}")
            };
            say.push(format!("{n} finished ({minutes} min{how}): {}", w.label));
            self.finished.push(FinishedJob {
                machine: self.machine.clone(),
                runner: n.clone(),
                start: w.start,
                end: now,
                result,
                label: w.label.clone(),
            });
            done.push(n.clone());
        }
        for n in done {
            self.waiting.remove(&n);
        }
        while self.used_logs.len() > USED_LOGS {
            self.used_logs.pop_front();
        }
        say
    }
}
