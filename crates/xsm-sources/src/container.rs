//! Runs one container action over its own one-shot `ssh`, away from the probe loop.

use crate::ssh::ssh_command_with;
use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use xsm_core::container::{docker_args, failure_text, success_text, timeout_text, Action};

/// Longest wait for the whole run.
const TIMEOUT: Duration = Duration::from_secs(20);
/// Pause between looks at the running command.
const POLL: Duration = Duration::from_millis(50);
/// Most bytes of one stream kept for the window; the rest is read and thrown away.
const MAX_OUTPUT: u64 = 64 * 1024;

/// Run `docker <action> <name>` on `host` and return the text for the window.
///
/// # Errors
/// Plain text: a bad name, ssh or docker failing (with a hint), or no answer within 20 seconds.
pub fn run_container_action(host: &str, action: Action, name: &str) -> Result<String, String> {
    let args = docker_args(action, name)?;
    run_command(ssh_command_with(host, &args), TIMEOUT, action, name)
}

fn drain(mut pipe: impl Read + Send + 'static) -> JoinHandle<String> {
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = pipe.by_ref().take(MAX_OUTPUT).read_to_end(&mut bytes);
        // Keep emptying the pipe so the far end is never stuck writing.
        let _ = std::io::copy(&mut pipe, &mut std::io::sink());
        String::from_utf8_lossy(&bytes).into_owned()
    })
}

/// `Some(success)` when the child ended in time, `None` when it was killed for taking too long.
fn wait(child: &mut Child, timeout: Duration) -> Option<bool> {
    let end = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Some(status.success()),
            Ok(None) if Instant::now() < end => thread::sleep(POLL),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

fn text_of(handle: Option<JoinHandle<String>>) -> String {
    handle.and_then(|h| h.join().ok()).unwrap_or_default()
}

/// What a finished run left: whether it succeeded, and both output streams.
pub struct Ran {
    /// True when the command ended with success.
    pub ok: bool,
    /// What it printed on stdout.
    pub stdout: String,
    /// What it printed on stderr.
    pub stderr: String,
}

/// Run `cmd`, wait up to `timeout`, and return what it printed.
///
/// # Errors
/// Plain text when the command cannot start or times out.
pub fn run_raw(mut cmd: Command, timeout: Duration) -> Result<Ran, String> {
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Could not start ssh on this PC.".to_owned())?;
    let out = child.stdout.take().map(drain);
    let err = child.stderr.take().map(drain);
    let ended = wait(&mut child, timeout);
    let (stdout, stderr) = (text_of(out), text_of(err));
    ended
        .map(|ok| Ran { ok, stdout, stderr })
        .ok_or_else(timeout_text)
}

/// Run `cmd`, wait up to `timeout`, and turn the result into window text.
///
/// # Errors
/// Plain text when the command cannot start, fails, or times out.
pub fn run_command(
    cmd: Command,
    timeout: Duration,
    action: Action,
    name: &str,
) -> Result<String, String> {
    let r = run_raw(cmd, timeout)?;
    if r.ok {
        Ok(success_text(action, name, &r.stdout, &r.stderr))
    } else {
        Err(failure_text(&r.stderr))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sh(script: &str) -> Command {
        let mut c = Command::new("sh");
        c.arg("-c").arg(script);
        c
    }
    const LONG: Duration = Duration::from_secs(10);

    #[test]
    fn logs_join_both_streams() {
        let r = run_command(sh("echo out; echo err >&2"), LONG, Action::Logs, "w");
        assert_eq!(r.unwrap(), "out\nerr\n");
    }

    #[test]
    fn long_output_is_cut_short() {
        let r = run_command(
            sh("head -c 300000 /dev/zero | tr '\\0' x"),
            LONG,
            Action::Logs,
            "w",
        );
        assert!(r.unwrap().len() as u64 <= 2 * MAX_OUTPUT);
    }

    #[test]
    fn short_answer() {
        let r = run_command(sh("echo w"), LONG, Action::Restart, "w");
        assert_eq!(r.unwrap(), "Restarted w.");
    }

    #[test]
    fn failure_is_friendly() {
        let r = run_command(
            sh("echo 'permission denied docker' >&2; exit 1"),
            LONG,
            Action::Stop,
            "w",
        );
        assert!(r.unwrap_err().contains("docker group"));
    }

    #[test]
    fn slow_run_times_out() {
        let r = run_command(sh("sleep 5"), Duration::from_millis(100), Action::Stop, "w");
        assert!(r.unwrap_err().contains("in time"));
    }

    #[test]
    fn missing_program() {
        let r = run_command(
            Command::new("/nonexistent/xsm-ssh"),
            LONG,
            Action::Stop,
            "w",
        );
        assert!(r.unwrap_err().contains("Could not start"));
    }

    #[test]
    fn bad_name_never_runs() {
        assert!(run_container_action("example-server", Action::Stop, "a b").is_err());
    }
}
