//! The biggest folders under a path: a directory walk on this PC, `du` over ssh on a Linux machine.
//! Both can be cancelled and both report how far they are. Nothing here ever deletes or changes a file.

use crate::ssh::ssh_command_with;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use xsm_core::drives::{biggest, parse_du, path_ok, Folder};

/// A scan stops after this long and says so.
const LIMIT: Duration = Duration::from_secs(90);
/// How deep (below the chosen path) folders are listed on their own; deeper files count toward their parent.
const DEPTH: usize = 2;
/// Pause between looks at a running `du`.
const POLL: Duration = Duration::from_millis(100);
/// Most bytes of `du` output read.
const MAX_OUTPUT: u64 = 8 * 1024 * 1024;

/// What a running scan shares with the window: whether to stop, and how many files it has looked at.
#[derive(Default)]
pub struct ScanControl {
    /// Set to ask the scan to stop.
    pub cancel: AtomicBool,
    /// Files looked at so far.
    pub seen: AtomicU64,
}

/// Why a scan gave no list.
#[derive(Debug, PartialEq, Eq)]
pub enum Stopped {
    /// The person cancelled.
    Cancelled,
    /// It took longer than the limit.
    TooSlow,
    /// A plain-words reason (bad path, ssh failing).
    Failed(String),
}

fn check(c: &ScanControl, start: Instant) -> Result<(), Stopped> {
    if c.cancel.load(Ordering::Relaxed) {
        Err(Stopped::Cancelled)
    } else if start.elapsed() > LIMIT {
        Err(Stopped::TooSlow)
    } else {
        Ok(())
    }
}

/// Add up `dir` (files directly and everywhere below it); folders down to `DEPTH` levels are also pushed to `out`.
fn walk(
    dir: &Path,
    level: usize,
    out: &mut Vec<Folder>,
    c: &ScanControl,
    start: Instant,
) -> Result<u64, Stopped> {
    check(c, start)?;
    let mut total = 0;
    for e in fs::read_dir(dir).into_iter().flatten().flatten() {
        let Ok(kind) = e.file_type() else { continue };
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            total += walk(&e.path(), level + 1, out, c, start)?;
        } else {
            c.seen.fetch_add(1, Ordering::Relaxed);
            total += e.metadata().map_or(0, |m| m.len());
        }
    }
    if level > 0 && level <= DEPTH {
        out.push(Folder {
            path: dir.to_string_lossy().into_owned(),
            bytes: total,
        });
    }
    Ok(total)
}

/// The biggest folders under `path` on this PC.
///
/// # Errors
/// [`Stopped`] when cancelled, too slow, or the path is not a folder.
pub fn scan_local(path: &str, c: &ScanControl) -> Result<Vec<Folder>, Stopped> {
    if !path_ok(path) || !Path::new(path).is_dir() {
        return Err(Stopped::Failed(
            "That is not a folder on this PC.".to_owned(),
        ));
    }
    let mut out = Vec::new();
    walk(Path::new(path), 0, &mut out, c, Instant::now())?;
    Ok(biggest(out))
}

/// The biggest folders under `path` on an ssh machine, from `du -x -d 2` (one file system, two levels).
///
/// # Errors
/// [`Stopped`] when cancelled, too slow, the path is bad, or ssh fails.
pub fn scan_ssh(host: &str, path: &str, c: &ScanControl) -> Result<Vec<Folder>, Stopped> {
    if !path_ok(path) {
        return Err(Stopped::Failed(
            "That is not a usable folder path.".to_owned(),
        ));
    }
    let (secs, depth) = (LIMIT.as_secs().to_string(), DEPTH.to_string());
    let remote = ["timeout", &secs, "du", "-x", "-k", "-d", &depth, "--", path];
    run_du(ssh_command_with(host, &remote), path, c)
}

/// Run a `du` command, wait for it (cancel and the limit end it early) and read its list.
fn run_du(mut cmd: Command, root: &str, c: &ScanControl) -> Result<Vec<Folder>, Stopped> {
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| Stopped::Failed("Could not start ssh on this PC.".to_owned()))?;
    let pipe = child.stdout.take();
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        if let Some(p) = pipe {
            let _ = p.take(MAX_OUTPUT).read_to_end(&mut bytes);
        }
        String::from_utf8_lossy(&bytes).into_owned()
    });
    let start = Instant::now();
    let ended = loop {
        match child.try_wait() {
            Ok(Some(_)) => break Ok(()),
            Ok(None) => match check(c, start) {
                Ok(()) => std::thread::sleep(POLL),
                Err(e) => break Err(e),
            },
            Err(_) => break Err(Stopped::Failed("Could not read the answer.".to_owned())),
        }
    };
    if ended.is_err() {
        let _ = child.kill();
        let _ = child.wait();
    }
    let text = reader.join().unwrap_or_default();
    ended?;
    let list = parse_du(&text, root.trim_end_matches('/'));
    if list.is_empty() {
        return Err(Stopped::Failed(
            "Nothing came back. Check the path, and that you can read it.".to_owned(),
        ));
    }
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_walk_lists_the_big_folder_first() {
        let dir = std::env::temp_dir().join(format!("xsm-folders-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("big/inner")).unwrap();
        fs::create_dir_all(dir.join("small")).unwrap();
        fs::write(dir.join("big/inner/f"), vec![0u8; 5000]).unwrap();
        fs::write(dir.join("small/f"), vec![0u8; 10]).unwrap();
        let c = ScanControl::default();
        let list = scan_local(&dir.to_string_lossy(), &c).unwrap();
        assert!(list[0].path.ends_with("big") && list[0].bytes == 5000);
        assert_eq!(c.seen.load(Ordering::Relaxed), 2);
        c.cancel.store(true, Ordering::Relaxed);
        assert_eq!(
            scan_local(&dir.to_string_lossy(), &c),
            Err(Stopped::Cancelled)
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn bad_paths_are_refused() {
        let c = ScanControl::default();
        assert!(matches!(
            scan_local("/nonexistent/xsm", &c),
            Err(Stopped::Failed(_))
        ));
        assert!(matches!(
            scan_ssh("example-server", "-rf", &c),
            Err(Stopped::Failed(_))
        ));
    }

    fn sh(script: &str) -> Command {
        let mut c = Command::new("sh");
        c.arg("-c").arg(script);
        c
    }

    #[test]
    fn du_output_is_read_cancelled_and_timed() {
        let c = ScanControl::default();
        let ok = run_du(sh("printf '40\\t/data/a\\n90\\t/data\\n'"), "/data", &c).unwrap();
        assert_eq!(ok[0].path, "/data/a");
        assert!(matches!(
            run_du(sh("true"), "/data", &c),
            Err(Stopped::Failed(_))
        ));
        assert!(matches!(
            run_du(Command::new("/nonexistent/xsm-ssh"), "/", &c),
            Err(Stopped::Failed(_))
        ));
        c.cancel.store(true, Ordering::Relaxed);
        assert_eq!(run_du(sh("sleep 5"), "/data", &c), Err(Stopped::Cancelled));
    }
}
