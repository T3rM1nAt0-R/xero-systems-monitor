//! How big each runner's `_work` folder is. Asked for on demand (the Runners tab), never polled:
//! on Linux one `ssh` runs `du` with a time limit per folder, on this PC the folders are walked here.

use crate::container::{drain, text_of, wait};
use crate::runners::runner_of_exe;
use crate::ssh::ssh_command_with;
use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

/// Longest wait for the whole ssh run.
const SSH_TIMEOUT: Duration = Duration::from_secs(40);
/// Longest wait for `du` on one folder, in seconds (passed to the remote `timeout`).
const DU_SECONDS: &str = "15";
/// Longest time spent walking folders on this PC.
const WALK_LIMIT: Duration = Duration::from_secs(10);
/// Bytes in a kibibyte (`du -sk` prints kibibytes).
const BYTES_PER_KIB: u64 = 1024;
/// Runs on the Linux machine: every runner folder found from its `Runner.Listener`, then its `_work` size in KiB (`-` when `du` was too slow).
/// No single quote may appear in it, because it is sent inside one pair of them.
const REMOTE: &str = "ps -eo args | grep -E \"[R]unner\\.Listener\" | sed -E \"s#^(.*)/bin[0-9.]*/Runner\\.Listener.*#\\1#\" | while read -r d; do n=$(basename \"$d\"); k=$(timeout DU du -sk \"$d/_work\" 2>/dev/null | cut -f1); echo \"$n ${k:--}\"; done";

/// One runner and the size of its work folder; `None` when it could not be measured in time.
pub type Size = (String, Option<u64>);

/// Read the lines `name kibibytes` (or `name -`) the remote script prints. Bad lines are skipped.
#[must_use]
pub fn parse_sizes(text: &str) -> Vec<Size> {
    text.lines()
        .filter_map(|line| {
            let (name, kib) = line.trim().rsplit_once(' ')?;
            let bytes = kib
                .parse::<u64>()
                .ok()
                .map(|k| k.saturating_mul(BYTES_PER_KIB));
            (!name.is_empty()).then(|| (name.to_owned(), bytes))
        })
        .collect()
}

/// Work-folder sizes of the runners on a Linux machine, over ssh.
///
/// # Errors
/// Plain text when ssh cannot start or does not answer in time.
pub fn remote_sizes(host: &str) -> Result<Vec<Size>, String> {
    let script = REMOTE.replace("DU", DU_SECONDS);
    let mut cmd = ssh_command_with(host, &["sh", "-c", &format!("'{script}'")]);
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "Could not start ssh on this PC.".to_owned())?;
    let out = child.stdout.take().map(drain);
    match wait(&mut child, SSH_TIMEOUT) {
        Some(_) => Ok(parse_sizes(&text_of(out))),
        None => Err("The machine did not answer in time.".to_owned()),
    }
}

/// Total size of the files under `dir`, stopping at `end` (`None` when time ran out).
fn walk(dir: &Path, end: Instant) -> Option<u64> {
    let mut total = 0;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        if Instant::now() > end {
            return None;
        }
        let Ok(meta) = entry.metadata() else { continue };
        total += if meta.is_dir() {
            walk(&entry.path(), end)?
        } else {
            meta.len()
        };
    }
    Some(total)
}

/// Work-folder sizes of the runners running on this PC.
#[must_use]
pub fn local_sizes() -> Vec<Size> {
    let Ok(mut sys) = System::new() else {
        return Vec::new();
    };
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
    );
    let end = Instant::now() + WALK_LIMIT;
    let mut seen: Vec<(String, Option<u64>)> = Vec::new();
    for p in sys.processes().values() {
        let Some(r) = p.exe().and_then(runner_of_exe) else {
            continue;
        };
        let name = r
            .dir
            .file_name()
            .map(|n| n.to_string_lossy().replace(' ', "_"));
        if let Some(name) = name.filter(|n| !seen.iter().any(|s| &s.0 == n)) {
            seen.push((name, walk(&r.dir.join("_work"), end)));
        }
    }
    seen
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lines_become_sizes() {
        let got = parse_sizes("runner-1 2048\nrunner-2 -\n\nbroken\n");
        assert_eq!(
            got,
            vec![
                ("runner-1".to_owned(), Some(2048 * 1024)),
                ("runner-2".to_owned(), None)
            ]
        );
    }

    #[test]
    fn the_remote_script_has_no_single_quote() {
        assert!(!REMOTE.contains('\''));
    }

    #[test]
    fn a_folder_is_added_up() {
        let dir = std::env::temp_dir().join(format!("xsm-walk-{}", std::process::id()));
        fs::create_dir_all(dir.join("a")).unwrap();
        fs::write(dir.join("a/x"), [0u8; 10]).unwrap();
        fs::write(dir.join("y"), [0u8; 5]).unwrap();
        assert_eq!(
            walk(&dir, Instant::now() + Duration::from_secs(5)),
            Some(15)
        );
        let past = Instant::now();
        std::thread::sleep(Duration::from_millis(5));
        assert_eq!(walk(&dir, past), None);
        fs::remove_dir_all(&dir).unwrap();
    }
}
