//! One machine's tracker: latest reading, online or offline, events, runner jobs and containers.

mod containers;
mod jobs;
mod view;

use crate::reading::Reading;
use containers::{Containers, Gone, Units};
use jobs::Runners;
use serde::{Serialize, Serializer};
use std::collections::{BTreeMap, BTreeSet};

pub(crate) use containers::FLAP_PHRASE;

/// The error shown before the first answer.
const STARTING: &str = "starting";
/// The error shown once a machine has missed too many polls in a row.
const OFFLINE: &str = "no answer from the machine";

/// Something worth telling the person, at a time. Serializes as `[t, machine, text]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Event {
    /// Unix seconds.
    pub t: i64,
    /// Machine name.
    pub machine: String,
    /// What happened.
    pub text: String,
}

impl Serialize for Event {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        (self.t, &self.machine, &self.text).serialize(s)
    }
}

/// A runner job that ended. Serializes as `[machine, runner, start, end, result, label]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinishedJob {
    /// Machine name.
    pub machine: String,
    /// Runner folder name.
    pub runner: String,
    /// Unix seconds the job began.
    pub start: i64,
    /// Unix seconds the end was noticed.
    pub end: i64,
    /// `Succeeded`, `Failed`, ... or empty when unknown.
    pub result: String,
    /// What the job was, e.g. `PR #7 · branch · Build (repo)`.
    pub label: String,
}

impl Serialize for FinishedJob {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        (
            &self.machine,
            &self.runner,
            self.start,
            self.end,
            &self.result,
            &self.label,
        )
            .serialize(s)
    }
}

/// Settings that shape one tracker.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rules {
    /// Missed polls in a row before the machine counts as offline.
    pub offline_after_misses: u32,
    /// True for a machine that runs CI runners.
    pub has_runners: bool,
}

/// What the window shows of one machine (its `Machine` shape).
#[derive(Debug, Clone, Serialize)]
pub struct Snapshot {
    /// Machine name.
    pub name: String,
    /// Why the machine is not reachable; `None` when it is.
    pub err: Option<String>,
    /// Unix seconds of the last answer.
    pub t: Option<i64>,
    /// The last reading.
    #[serde(rename = "d", serialize_with = "view::reading")]
    pub latest: Reading,
    /// Runner to the time its current job began.
    pub started: BTreeMap<String, i64>,
    /// Runners that stopped reporting.
    pub gone: BTreeSet<String>,
    /// Containers that disappeared: name, time, state, status text, image.
    #[serde(serialize_with = "gone_rows")]
    pub cgone: BTreeMap<String, Gone>,
}

/// Newest first, each as `[name, t, state, text, image]`.
fn gone_rows<S: Serializer>(m: &BTreeMap<String, Gone>, s: S) -> Result<S::Ok, S::Error> {
    let mut rows: Vec<_> = m.iter().map(|(n, g)| (n, g.0, &g.1, &g.2, &g.3)).collect();
    rows.sort_by_key(|r| std::cmp::Reverse(r.1));
    rows.serialize(s)
}

/// Follows one machine.
pub struct Tracker {
    name: String,
    rules: Rules,
    err: Option<String>,
    t: Option<i64>,
    misses: u32,
    latest: Reading,
    runners: Runners,
    containers: Containers,
    units: Units,
}

impl Tracker {
    /// A tracker for the machine `name`, starting before its first answer.
    #[must_use]
    pub fn new(name: &str, rules: Rules) -> Self {
        Self {
            name: name.to_owned(),
            rules,
            err: Some(STARTING.to_owned()),
            t: None,
            misses: 0,
            latest: Reading::default(),
            runners: Runners::new(name),
            containers: Containers::default(),
            units: Units::default(),
        }
    }

    fn events(&self, now_s: i64, texts: Vec<String>) -> Vec<Event> {
        let machine = || self.name.clone();
        texts
            .into_iter()
            .map(|text| Event {
                t: now_s,
                machine: machine(),
                text,
            })
            .collect()
    }

    /// The machine answered. Returns the events this reading caused.
    pub fn observe(&mut self, reading: Reading, now_s: i64) -> Vec<Event> {
        let mut say = Vec::new();
        self.misses = 0;
        if self.err.take().is_some_and(|e| e != STARTING) {
            say.push("back online".to_owned());
        }
        self.t = Some(now_s);
        if self.rules.has_runners {
            say.extend(self.runners.observe(&reading, now_s));
        }
        if let (Some(list), None) = (&reading.containers, &reading.docker_error) {
            say.extend(self.containers.observe(list, now_s));
        }
        let failed = reading
            .failed_services
            .iter()
            .map(|f| f.unit.clone())
            .collect();
        say.extend(self.units.observe(&failed));
        self.latest = reading;
        self.events(now_s, say)
    }

    /// The machine did not answer this poll. After enough misses in a row it is offline.
    pub fn miss(&mut self, now_s: i64) -> Vec<Event> {
        self.misses = self.misses.saturating_add(1);
        let already = self.err.as_deref() == Some(OFFLINE);
        if self.misses < self.rules.offline_after_misses || already {
            return Vec::new();
        }
        self.err = Some(OFFLINE.to_owned());
        self.events(now_s, vec!["went offline".to_owned()])
    }

    /// Jobs that finished since the last call.
    pub fn take_finished(&mut self) -> Vec<FinishedJob> {
        std::mem::take(&mut self.runners.finished)
    }

    /// What the window shows of this machine now.
    #[must_use]
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            name: self.name.clone(),
            err: self.err.clone(),
            t: self.t,
            latest: self.latest.clone(),
            started: self.runners.started.clone(),
            gone: self.runners.gone.clone(),
            cgone: self.containers.gone.clone(),
        }
    }
}
