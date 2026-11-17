//! CI runners on this PC: GitHub Actions `Runner.Listener` and `Runner.Worker` processes and
//! their worker logs. They are written as the same `RUNNER`, `JOB`, `JOBRES` and `JRES` lines the
//! Linux probe prints, so one parser in `xsm-core` reads runners from every machine.

use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use sysinfo::{Pid, System};

/// A worker log touched this recently may hold the result of a job that just ended.
const RESULT_WINDOW: Duration = Duration::from_mins(1);
/// The job's name sits near the start of a worker log; only this much is read for it.
const HEAD_BYTES: u64 = 1024 * 1024;
/// The line a worker log prints once every job step is done.
const RESULT_MARK: &str = "Job result after all job steps finish: ";
/// Bytes in a mebibyte.
const BYTES_PER_MIB: u64 = 1024 * 1024;

/// The job a worker log names. Empty text means unknown.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LogJob {
    /// Job display name.
    pub name: String,
    /// Repository, `owner/name`.
    pub repo: String,
    /// Git ref, e.g. `refs/pull/7/merge`.
    pub git_ref: String,
    /// Source branch of a pull request.
    pub head_ref: String,
}

/// The first `"key": "value"` in `text` whose value starts with `prefix`.
fn field(text: &str, key: &str, prefix: &str) -> Option<String> {
    let quoted = format!("\"{key}\":");
    let mut rest = text;
    while let Some(at) = rest.find(&quoted) {
        rest = &rest[at + quoted.len()..];
        let Some(value) = rest.trim_start_matches(' ').strip_prefix('"') else {
            continue;
        };
        let Some(end) = value.find('"') else {
            break;
        };
        if value[..end].starts_with(prefix) {
            return Some(value[..end].to_owned());
        }
    }
    None
}

/// The job named in the text of a worker log (the same fields the Linux probe reads).
#[must_use]
pub fn parse_worker_job(text: &str) -> LogJob {
    let get = |key, prefix| field(text, key, prefix).unwrap_or_default();
    LogJob {
        name: get("jobDisplayName", ""),
        repo: get("repository", ""),
        git_ref: get("ref", "refs/"),
        head_ref: get("head_ref", ""),
    }
}

/// The result word (`Succeeded`, `Failed`, `Canceled`...) a finished worker log prints.
#[must_use]
pub fn parse_worker_result(text: &str) -> Option<String> {
    let at = text.find(RESULT_MARK)? + RESULT_MARK.len();
    let word: String = text[at..]
        .chars()
        .take_while(char::is_ascii_alphabetic)
        .collect();
    (!word.is_empty()).then_some(word)
}

/// A runner process: the runner's folder and its kind.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunnerProcess {
    /// The runner folder (the parent of its `bin` folder).
    pub dir: PathBuf,
    /// True for a `Runner.Worker` (a job is running).
    pub worker: bool,
}

/// The runner a program path belongs to, e.g. `C:\r\jc-1\bin\Runner.Worker.exe`.
#[must_use]
pub fn runner_of_exe(exe: &Path) -> Option<RunnerProcess> {
    let file = exe.file_name()?.to_string_lossy().to_ascii_lowercase();
    let stem = file.strip_suffix(".exe").unwrap_or(&file);
    let worker = match stem {
        "runner.worker" => true,
        "runner.listener" => false,
        _ => return None,
    };
    let bin = exe.parent()?;
    let versioned = bin.file_name()?.to_str()?.strip_prefix("bin")?;
    if !versioned.chars().all(|c| c.is_ascii_digit() || c == '.') {
        return None;
    }
    let dir = bin.parent()?.to_path_buf();
    dir.file_name()?;
    Some(RunnerProcess { dir, worker })
}

/// A path the way the probe prints it: forward slashes.
fn slashes(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

/// One probe word: `_` for a space, `-` for nothing.
fn word(s: &str) -> String {
    if s.is_empty() {
        "-".to_owned()
    } else {
        s.replace(' ', "_")
    }
}

/// Worker logs of a runner folder with their last change, newest first.
fn worker_logs(dir: &Path) -> Vec<(PathBuf, SystemTime)> {
    let Ok(list) = fs::read_dir(dir.join("_diag")) else {
        return Vec::new();
    };
    let mut logs: Vec<(PathBuf, SystemTime)> = list
        .flatten()
        .filter(|e| {
            let p = e.path();
            let log = p.extension().is_some_and(|x| x.eq_ignore_ascii_case("log"));
            log && e.file_name().to_string_lossy().starts_with("Worker_")
        })
        .filter_map(|e| Some((e.path(), e.metadata().ok()?.modified().ok()?)))
        .collect();
    logs.sort_by_key(|l| std::cmp::Reverse(l.1));
    logs
}

/// Up to `limit` bytes of a file as text.
fn read_text(path: &Path, limit: u64) -> String {
    let mut text = String::new();
    if let Ok(f) = fs::File::open(path) {
        let mut bytes = Vec::new();
        if f.take(limit).read_to_end(&mut bytes).is_ok() {
            text = String::from_utf8_lossy(&bytes).into_owned();
        }
    }
    text
}

/// Finds runners among this PC's programs and remembers what their logs said, so each log
/// is read once: a running job's name once per log, a result once per change of the log.
#[derive(Default)]
pub struct RunnerWatch {
    jobs: HashMap<PathBuf, LogJob>,
    results: HashMap<PathBuf, (SystemTime, Option<String>)>,
}

impl RunnerWatch {
    /// Probe lines about the runners in `sys` (its processes must be refreshed). Empty when none run.
    pub fn lines(&mut self, sys: &System, now: SystemTime) -> String {
        let threads = sys.cpus().len().max(1);
        let mut kids: HashMap<Pid, Vec<Pid>> = HashMap::new();
        for (pid, p) in sys.processes() {
            if let Some(parent) = p.parent() {
                kids.entry(parent).or_default().push(*pid);
            }
        }
        let mut out = String::new();
        let mut folders: Vec<PathBuf> = Vec::new();
        for (pid, p) in sys.processes() {
            let Some(r) = p.exe().and_then(runner_of_exe) else {
                continue;
            };
            let kind = if r.worker { "Worker" } else { "Listener" };
            let bin = p
                .exe()
                .and_then(Path::parent)
                .map(slashes)
                .unwrap_or_default();
            let _ = writeln!(out, "RUNNER {bin}/Runner.{kind}");
            let name = r
                .dir
                .file_name()
                .map(|n| n.to_string_lossy().replace(' ', "_"))
                .unwrap_or_default();
            if r.worker {
                let job = self.job_of(&r.dir);
                let _ = writeln!(
                    out,
                    "JOB {name} {} {} {} {}",
                    word(&job.name),
                    word(&job.repo),
                    word(&job.git_ref),
                    word(&job.head_ref)
                );
                let (cpu, ram) = tree_use(sys, &kids, *pid);
                let _ = writeln!(
                    out,
                    "JOBRES {name} {:.1} {} -",
                    cpu / to_f64(threads),
                    ram / BYTES_PER_MIB
                );
            } else if !folders.contains(&r.dir) {
                folders.push(r.dir);
            }
        }
        for dir in folders {
            out.push_str(&self.result_lines(&dir, now));
        }
        out
    }

    /// The job named in the newest worker log of a runner.
    fn job_of(&mut self, dir: &Path) -> LogJob {
        let Some((log, _)) = worker_logs(dir).into_iter().next() else {
            return LogJob {
                name: "(runner log not readable)".to_owned(),
                ..LogJob::default()
            };
        };
        if let Some(job) = self.jobs.get(&log).filter(|j| !j.name.is_empty()) {
            return job.clone();
        }
        let job = parse_worker_job(&read_text(&log, HEAD_BYTES));
        self.jobs.insert(log, job.clone());
        job
    }

    /// `JRES` lines for worker logs of `dir` changed within the last minute that hold a result.
    fn result_lines(&mut self, dir: &Path, now: SystemTime) -> String {
        let name = dir
            .file_name()
            .map(|n| n.to_string_lossy().replace(' ', "_"))
            .unwrap_or_default();
        let mut out = String::new();
        for (log, changed) in worker_logs(dir) {
            if now.duration_since(changed).unwrap_or_default() > RESULT_WINDOW {
                break;
            }
            let cached = self.results.get(&log).filter(|(t, _)| *t == changed);
            let result = if let Some((_, r)) = cached {
                r.clone()
            } else {
                let r = parse_worker_result(&read_text(&log, u64::MAX));
                self.results.insert(log.clone(), (changed, r.clone()));
                r
            };
            if let (Some(r), Some(file)) = (result, log.file_name()) {
                let _ = writeln!(out, "JRES {name} {r} {}", file.to_string_lossy());
            }
        }
        out
    }
}

/// A byte count as f64.
// reason: counts stay far below 2^53, where f64 is exact
#[allow(clippy::cast_precision_loss)]
fn to_f64(n: usize) -> f64 {
    n as f64
}

/// CPU (summed percent of one thread) and memory in bytes of a process and all its children.
fn tree_use(sys: &System, kids: &HashMap<Pid, Vec<Pid>>, root: Pid) -> (f64, u64) {
    let (mut cpu, mut ram) = (0.0, 0);
    let mut todo = vec![root];
    while let Some(pid) = todo.pop() {
        if let Some(p) = sys.process(pid) {
            cpu += f64::from(p.cpu_usage());
            ram += p.memory();
        }
        todo.extend(kids.get(&pid).into_iter().flatten().copied());
    }
    (cpu, ram)
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOG: &str = r#"[2026-01-01 10:00:00Z INFO Worker] Job message:
 {
  "jobDisplayName": "Fast check",
  "repository": "example/project",
  "ref": "abc123",
  "ref": "refs/pull/7/merge",
  "head_ref": "feature-x"
 }
[2026-01-01 10:05:00Z INFO JobRunner] Job result after all job steps finish: Failed
"#;

    #[test]
    fn reads_the_job_and_result_from_a_worker_log() {
        let job = parse_worker_job(LOG);
        assert_eq!(job.name, "Fast check");
        assert_eq!(job.repo, "example/project");
        assert_eq!(job.git_ref, "refs/pull/7/merge");
        assert_eq!(job.head_ref, "feature-x");
        assert_eq!(parse_worker_result(LOG).as_deref(), Some("Failed"));
        assert_eq!(parse_worker_result("still running"), None);
        assert_eq!(parse_worker_job("nothing here"), LogJob::default());
    }

    #[test]
    fn finds_runner_programs_by_their_path() {
        let worker = runner_of_exe(Path::new("/r/jc-1/bin.2.330.0/Runner.Worker.exe")).unwrap();
        assert!(worker.worker);
        assert_eq!(worker.dir, Path::new("/r/jc-1"));
        let listener = runner_of_exe(Path::new("/r/jc-2/bin/Runner.Listener")).unwrap();
        assert!(!listener.worker);
        assert_eq!(runner_of_exe(Path::new("/r/jc-1/bin/other.exe")), None);
        assert_eq!(
            runner_of_exe(Path::new("/r/jc-1/tools/Runner.Worker.exe")),
            None
        );
    }

    #[test]
    fn writes_lines_the_core_parser_reads() {
        let mut text = String::from(
            "RUNNER C:/r/jc-1/bin/Runner.Worker\nRUNNER C:/r/jc-2/bin/Runner.Listener\n",
        );
        text.push_str("JOB jc-1 ");
        text.push_str(&word("Fast check"));
        text.push_str(" example/project refs/heads/main -\n");
        text.push_str("JOBRES jc-1 12.5 300 -\nJRES jc-2 Succeeded Worker_1.log\n");
        let r = xsm_core::parse::parse_frame(&text, None);
        assert_eq!(r.runners.len(), 2);
        assert!(r.runners.iter().any(|x| x.name == "jc-1" && x.busy));
        let job = r.jobs.iter().find(|j| j.runner == "jc-1").unwrap();
        assert_eq!(job.name, "Fast check");
        assert_eq!(
            r.jobs
                .iter()
                .find(|j| j.runner == "jc-2")
                .unwrap()
                .result
                .as_deref(),
            Some("Succeeded")
        );
    }

    #[test]
    fn reads_results_of_logs_that_just_changed() {
        let dir = std::env::temp_dir()
            .join(format!("xsm-runner-test-{}", std::process::id()))
            .join("jc-1");
        fs::create_dir_all(dir.join("_diag")).unwrap();
        fs::write(dir.join("_diag").join("Worker_1.log"), LOG).unwrap();
        let mut w = RunnerWatch::default();
        let now = SystemTime::now();
        assert_eq!(w.result_lines(&dir, now), "JRES jc-1 Failed Worker_1.log\n");
        assert_eq!(w.job_of(&dir).name, "Fast check");
        assert_eq!(w.result_lines(&dir, now + RESULT_WINDOW * 2), "");
        let _ = fs::remove_dir_all(dir.parent().unwrap());
    }
}
