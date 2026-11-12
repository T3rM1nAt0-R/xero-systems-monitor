//! One long-lived `ssh` per machine running the probe in a loop on the far side.

use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError, Sender, TryRecvError};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::Duration;

/// The line that ends every frame.
pub const FRAME_END: &str = "@@END";
/// Wait before the first reconnect when the caller gives no number (the settings default).
const DEFAULT_RECONNECT_S: u32 = 10;
/// The wait grows by this factor after each failed attempt.
const BACKOFF_FACTOR: u32 = 2;
/// The wait never grows beyond this many times the first wait.
const BACKOFF_CAP_TIMES: u32 = 6;
/// Seconds ssh waits for the connection to open.
const CONNECT_TIMEOUT_S: &str = "4";
/// Seconds between ssh keep-alive messages.
const ALIVE_INTERVAL_S: &str = "5";
/// Missed keep-alives before ssh gives up.
const ALIVE_MAX_MISSES: &str = "2";
/// The probe runs full (hardware names) on the 1st and every this many frames.
const FULL_EVERY: u32 = 100;
/// The probe lists the busiest programs on the 1st and every this many frames.
const TOP_EVERY: u32 = 5;
/// Bytes read from ssh at a time.
const READ_CHUNK: usize = 4096;

/// Where the connection stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnState {
    /// Starting ssh, no frame yet.
    Connecting,
    /// Frames are arriving.
    Connected,
    /// ssh ended; waiting before the next try.
    Disconnected,
}

/// Add `chunk` to `pending` and return every frame it completed (the text before a `@@END` line).
/// Whatever is left after the last end line stays in `pending` for the next chunk.
pub fn split_frames(pending: &mut String, chunk: &str) -> Vec<String> {
    pending.push_str(chunk);
    let mut frames = Vec::new();
    let mut frame = String::new();
    let mut consumed = 0;
    for line in pending.split_inclusive('\n') {
        if !line.ends_with('\n') {
            break;
        }
        consumed += line.len();
        let text = line.trim_end_matches(['\r', '\n']);
        if text == FRAME_END {
            frames.push(std::mem::take(&mut frame));
        } else {
            frame.push_str(text);
            frame.push('\n');
        }
    }
    // A half-read frame goes back, so the next chunk continues it.
    let rest = format!("{frame}{}", &pending[consumed..]);
    *pending = rest;
    frames
}

/// The wait after `current`: longer each time, never above `cap`.
#[must_use]
pub fn next_backoff(current: Duration, cap: Duration) -> Duration {
    (current * BACKOFF_FACTOR).min(cap)
}

/// The shell loop sent on stdin: runs `probe` every `interval_s` seconds and prints [`FRAME_END`] after each.
fn loop_script(probe: &str, interval_s: u32) -> String {
    format!(
        "n=0\nwhile :; do\nn=$((n+1))\nif [ $((n % {FULL_EVERY})) = 1 ]; then F=1; else F=; fi\n\
         if [ $((n % {TOP_EVERY})) = 1 ]; then P=1; else P=; fi\nexport F P\n\
         (\n{}\n) </dev/null 2>/dev/null\necho {FRAME_END}\nsleep {interval_s}\ndone\n",
        probe.replace('\r', "")
    )
}

/// The system `ssh` for `host`: uses `~/.ssh/config` and keys, never asks for a password.
#[must_use]
pub fn ssh_command(host: &str) -> Command {
    let mut cmd = Command::new("ssh");
    cmd.args(["-o", "BatchMode=yes", "-o"])
        .arg(format!("ConnectTimeout={CONNECT_TIMEOUT_S}"))
        .arg("-o")
        .arg(format!("ServerAliveInterval={ALIVE_INTERVAL_S}"))
        .arg("-o")
        .arg(format!("ServerAliveCountMax={ALIVE_MAX_MISSES}"))
        .args(["--", host, "sh"]);
    cmd
}

#[derive(Default)]
struct Shared {
    latest: Option<String>,
    state: Option<ConnState>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// A running connection to one machine. Dropping it kills ssh and stops the thread.
pub struct SshSource {
    shared: Arc<Mutex<Shared>>,
    child: Arc<Mutex<Option<Child>>>,
    stop: Option<Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl SshSource {
    /// Connect to `host` with the system `ssh` and run `probe_script` every `interval_s` seconds.
    #[must_use]
    pub fn spawn(host: &str, probe_script: &str, interval_s: u32) -> Self {
        let host = host.to_owned();
        Self::spawn_command(
            move || ssh_command(&host),
            probe_script,
            interval_s,
            DEFAULT_RECONNECT_S,
        )
    }

    /// Like [`SshSource::spawn`] with the command that starts the far shell passed in
    /// (tests give a fake) and the first reconnect wait in seconds (`ssh_reconnect_seconds`).
    #[must_use]
    pub fn spawn_command<F>(make: F, probe_script: &str, interval_s: u32, reconnect_s: u32) -> Self
    where
        F: Fn() -> Command + Send + 'static,
    {
        let shared = Arc::new(Mutex::new(Shared::default()));
        let child = Arc::new(Mutex::new(None));
        let (stop, stop_rx) = mpsc::channel::<()>();
        let script = loop_script(probe_script, interval_s);
        let (sh, ch) = (Arc::clone(&shared), Arc::clone(&child));
        let first = Duration::from_secs(u64::from(reconnect_s));
        let thread = thread::spawn(move || {
            let mut wait = first;
            loop {
                lock(&sh).state = Some(ConnState::Connecting);
                if run_once(&make, &script, &sh, &ch, &stop_rx) {
                    wait = first;
                }
                lock(&sh).state = Some(ConnState::Disconnected);
                match stop_rx.recv_timeout(wait) {
                    Err(RecvTimeoutError::Timeout) => {
                        wait = next_backoff(wait, first * BACKOFF_CAP_TIMES);
                    }
                    _ => return,
                }
            }
        });
        Self {
            shared,
            child,
            stop: Some(stop),
            thread: Some(thread),
        }
    }

    /// The newest frame not yet taken, or `None` when no new frame arrived since the last call.
    #[must_use]
    pub fn try_latest(&self) -> Option<String> {
        lock(&self.shared).latest.take()
    }

    /// Where the connection stands now.
    #[must_use]
    pub fn state(&self) -> ConnState {
        lock(&self.shared).state.unwrap_or(ConnState::Connecting)
    }
}

impl Drop for SshSource {
    fn drop(&mut self) {
        drop(self.stop.take());
        if let Some(mut c) = lock(&self.child).take() {
            let _ = c.kill();
            let _ = c.wait();
        }
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// One connection: start the child, send the loop, read frames until it ends.
/// True when at least one frame arrived (so the wait can start over).
fn run_once(
    make: &impl Fn() -> Command,
    script: &str,
    shared: &Mutex<Shared>,
    slot: &Mutex<Option<Child>>,
    stop_rx: &mpsc::Receiver<()>,
) -> bool {
    let mut cmd = make();
    crate::hide_window(&mut cmd);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let Ok(mut child) = cmd.spawn() else {
        return false;
    };
    let (stdin, stdout) = (child.stdin.take(), child.stdout.take());
    {
        let mut held = lock(slot);
        if matches!(stop_rx.try_recv(), Err(TryRecvError::Disconnected)) {
            let _ = child.kill();
            return false;
        }
        *held = Some(child);
    }
    let (Some(mut stdin), Some(mut out)) = (stdin, stdout) else {
        return false;
    };
    // The far shell keeps running the loop; stdin stays open until this function ends.
    let _ = stdin
        .write_all(script.as_bytes())
        .and_then(|()| stdin.flush());
    let (mut pending, mut buf, mut got) = (String::new(), [0u8; READ_CHUNK], false);
    while let Ok(n @ 1..) = out.read(&mut buf) {
        for frame in split_frames(&mut pending, &String::from_utf8_lossy(&buf[..n])) {
            let mut s = lock(shared);
            s.latest = Some(frame);
            s.state = Some(ConnState::Connected);
            got = true;
        }
    }
    if let Some(mut c) = lock(slot).take() {
        let _ = c.kill();
        let _ = c.wait();
    }
    got
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn fake(script: &str) -> impl Fn() -> Command + Send + 'static {
        let script = script.to_owned();
        move || {
            let mut c = Command::new("sh");
            c.arg("-c").arg(&script);
            c
        }
    }

    fn wait_for<T>(mut f: impl FnMut() -> Option<T>) -> Option<T> {
        let end = Instant::now() + Duration::from_secs(10);
        while Instant::now() < end {
            if let Some(v) = f() {
                return Some(v);
            }
            thread::sleep(Duration::from_millis(20));
        }
        None
    }

    #[test]
    fn splits_whole_frames() {
        let mut p = String::new();
        let f = split_frames(&mut p, "a 1\nb 2\n@@END\nc 3\n@@END\nd");
        assert_eq!(f, ["a 1\nb 2\n", "c 3\n"]);
        assert_eq!(p, "d");
    }

    #[test]
    fn splits_across_chunks_and_crlf() {
        let mut p = String::new();
        assert!(split_frames(&mut p, "a 1\r\nb").is_empty());
        assert!(split_frames(&mut p, " 2\r\n@@E").is_empty());
        assert_eq!(split_frames(&mut p, "ND\r\n"), ["a 1\nb 2\n"]);
        assert_eq!(p, "");
    }

    #[test]
    fn empty_frame_and_no_marker() {
        let mut p = String::new();
        assert_eq!(split_frames(&mut p, "@@END\n"), [""]);
        assert!(split_frames(&mut p, "x\n").is_empty());
    }

    #[test]
    fn backoff_doubles_to_cap() {
        let cap = Duration::from_mins(1);
        let s10 = Duration::from_secs(10);
        assert_eq!(next_backoff(s10, cap), Duration::from_secs(20));
        assert_eq!(next_backoff(Duration::from_secs(40), cap), cap);
    }

    #[test]
    fn reads_frames_from_a_fake_ssh() {
        let src = SshSource::spawn_command(
            fake("echo 'MEM 1 2'; echo @@END; exec sleep 30"),
            "true",
            1,
            1,
        );
        let frame = wait_for(|| src.try_latest());
        assert_eq!(frame.as_deref(), Some("MEM 1 2\n"));
        assert_eq!(src.state(), ConnState::Connected);
        assert_eq!(src.try_latest(), None);
    }

    #[test]
    fn runs_the_real_probe_through_a_local_shell() {
        let probe = include_str!("../../../probes/probe.sh");
        let make = || {
            let mut c = Command::new("sh");
            c.arg("-s");
            c
        };
        let src = SshSource::spawn_command(make, probe, 1, 1);
        let frame = wait_for(|| src.try_latest()).unwrap_or_default();
        let reading = xsm_core::parse::parse_frame(&frame, None);
        assert!(reading.memory.is_some());
    }

    #[test]
    fn reconnects_after_the_connection_ends() {
        let src = SshSource::spawn_command(fake("echo 'x 1'; echo @@END"), "true", 1, 0);
        assert!(wait_for(|| src.try_latest()).is_some());
        assert!(wait_for(|| src.try_latest()).is_some());
    }

    #[test]
    fn a_missing_program_is_disconnected_not_a_crash() {
        let src = SshSource::spawn_command(|| Command::new("no-such-ssh-binary"), "true", 1, 1);
        assert!(wait_for(|| (src.state() == ConnState::Disconnected).then_some(())).is_some());
        assert_eq!(src.try_latest(), None);
    }

    #[test]
    fn drop_kills_the_child() {
        let file = std::env::temp_dir().join(format!("xsm-fake-ssh-{}", std::process::id()));
        let script = format!("echo $$ > {}; exec sleep 30", file.display());
        let src = SshSource::spawn_command(fake(&script), "true", 1, 1);
        let pid = wait_for(|| {
            std::fs::read_to_string(&file)
                .ok()
                .filter(|s| s.ends_with('\n'))
        });
        let pid = pid.unwrap_or_default().trim().to_owned();
        let _ = std::fs::remove_file(&file);
        assert!(!pid.is_empty());
        let alive = || {
            Command::new("kill")
                .args(["-0", &pid])
                .status()
                .is_ok_and(|s| s.success())
        };
        assert!(alive());
        drop(src);
        assert!(wait_for(|| (!alive()).then_some(())).is_some());
    }
}
