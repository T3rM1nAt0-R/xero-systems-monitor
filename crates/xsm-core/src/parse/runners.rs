//! `RUNNER`, `JOB`, `JOBRES` and `JRES` lines about CI runners.

use crate::reading::{JobLine, Reading, RunnerState};

/// What the probe prints for an unknown value.
const UNKNOWN: &str = "-";
/// The five words of a `JOB` line after the tag.
const JOB_WORDS: usize = 5;

/// `-` means unknown; `_` stands for a space.
fn text(word: &str) -> String {
    if word == UNKNOWN {
        String::new()
    } else {
        word.replace('_', " ")
    }
}

fn optional<T: std::str::FromStr>(word: &str) -> Option<T> {
    word.parse().ok()
}

/// The job entry of a runner, added when missing.
fn job<'a>(r: &'a mut Reading, runner: &str) -> &'a mut JobLine {
    let at = r.jobs.iter().position(|j| j.runner == runner);
    let at = at.unwrap_or_else(|| {
        r.jobs.push(JobLine {
            runner: runner.to_owned(),
            ..JobLine::default()
        });
        r.jobs.len() - 1
    });
    &mut r.jobs[at]
}

/// The runner folder in a process line like `/home/user/runner-1/bin.2.3/Runner.Worker run`.
fn runner_of(command: &str) -> Option<(&str, bool)> {
    let (dir, kind) = command.split_once("/Runner.")?;
    let (parent, bin) = dir.rsplit_once('/')?;
    let versioned = bin.strip_prefix("bin")?;
    let name = parent.rsplit('/').next().filter(|n| !n.contains(' '))?;
    let numbered = versioned.chars().all(|c| c.is_ascii_digit() || c == '.');
    let busy = kind.starts_with("Worker");
    (numbered && !name.is_empty() && (busy || kind.starts_with("Listener"))).then_some((name, busy))
}

pub(super) fn line(tag: &str, r: &mut Reading, rest: &str) -> Option<()> {
    let mut words: Vec<&str> = rest.split_whitespace().collect();
    match tag {
        "RUNNER" => {
            let (name, busy) = runner_of(rest)?;
            match r.runners.iter_mut().find(|x| x.name == name) {
                Some(known) => known.busy |= busy,
                None => r.runners.push(RunnerState {
                    name: name.to_owned(),
                    busy,
                }),
            }
        }
        "JOB" => {
            words.first()?;
            words.resize(JOB_WORDS + 1, UNKNOWN);
            let [runner, name, repo, git_ref, head_ref] = words[..JOB_WORDS] else {
                return None;
            };
            let j = job(r, runner);
            (j.name, j.repo) = (text(name), text(repo));
            (j.git_ref, j.head_ref) = (text(git_ref), text(head_ref));
        }
        "JOBRES" => {
            let [runner, cpu, ram, vram, ..] = words[..] else {
                return None;
            };
            let (cpu, ram) = (cpu.parse().ok()?, ram.parse::<u64>().ok()?);
            let j = job(r, runner);
            j.cpu_pct = Some(cpu);
            j.ram_bytes = Some(ram * super::BYTES_PER_MIB);
            j.vram_bytes = optional::<u64>(vram).map(|mib| mib * super::BYTES_PER_MIB);
        }
        _ => {
            let [runner, result, log] = words[..] else {
                return None;
            };
            let j = job(r, runner);
            j.result = Some(result.to_owned());
            j.result_log = Some(log.to_owned());
        }
    }
    Some(())
}
