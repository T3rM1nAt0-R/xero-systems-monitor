//! Runs the fixed system commands of `xsm_core::system`: over `ssh` for Linux machines, in PowerShell for this PC.

use crate::container::run_raw;
use crate::ssh::ssh_command_with;
use std::process::Command;
use std::time::Duration;
use xsm_core::system::{
    failure_text, linux_action, linux_logs, linux_query, needs_password, password_reply,
    success_text, windows_action, windows_logs, windows_query, Act, Priority, Query, QUICK_SECONDS,
};

/// Where a command runs.
#[derive(Debug, Clone, Copy)]
pub enum Target<'a> {
    /// A Linux machine reached over `ssh`.
    Ssh(&'a str),
    /// This PC (Windows).
    Pc,
}

fn command(target: Target<'_>, linux: &str, windows: &str) -> Command {
    match target {
        Target::Ssh(host) => ssh_command_with(host, &[linux]),
        Target::Pc => {
            let mut c = Command::new("powershell");
            c.args(["-NoProfile", "-NonInteractive", "-Command", windows]);
            c
        }
    }
}

/// Read services or the update count; returns the command's text for the window to parse.
///
/// # Errors
/// Plain text when the read does not exist for this machine, cannot start, fails or times out.
pub fn run_query(target: Target<'_>, q: Query) -> Result<String, String> {
    let win = match target {
        Target::Pc => windows_query(q).ok_or("Updates are only checked on Linux machines.")?,
        Target::Ssh(_) => String::new(),
    };
    let r = run_raw(
        command(target, &linux_query(q), &win),
        Duration::from_secs(QUICK_SECONDS),
    )?;
    if r.ok {
        Ok(r.stdout)
    } else {
        Err(failure_text(&r.stderr))
    }
}

/// Read the recent log lines (Linux: `journalctl`, optionally one unit; This PC: System and Application events as JSON).
///
/// # Errors
/// Plain text when the unit is not a service name, or the read cannot start, fails or times out.
pub fn run_logs(
    target: Target<'_>,
    priority: Priority,
    unit: Option<&str>,
) -> Result<String, String> {
    let (linux, win) = match target {
        Target::Ssh(_) => (linux_logs(priority, unit)?, String::new()),
        Target::Pc => (String::new(), windows_logs(priority)),
    };
    let r = run_raw(
        command(target, &linux, &win),
        Duration::from_secs(QUICK_SECONDS),
    )?;
    if r.ok {
        Ok(r.stdout)
    } else {
        Err(failure_text(&r.stderr))
    }
}

/// Do one action; returns the sentence for the window. On Linux it uses `sudo -n` only: when sudo needs a password
/// the error starts with `needs-password:` followed by the command for the person to run themselves.
///
/// # Errors
/// Plain text, or the password reply above.
pub fn run_action(target: Target<'_>, act: Act, name: &str) -> Result<String, String> {
    let (linux, win) = match target {
        Target::Ssh(_) => (linux_action(act, name, "sudo -n")?, String::new()),
        Target::Pc => (String::new(), windows_action(act, name)?),
    };
    let r = run_raw(
        command(target, &linux, &win),
        Duration::from_secs(act.seconds()),
    )?;
    if r.ok {
        Ok(success_text(act, name))
    } else if needs_password(&r.stderr) {
        Err(password_reply(act, name))
    } else {
        Err(failure_text(&r.stderr))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bad_names_never_run() {
        assert!(run_action(Target::Ssh("example-server"), Act::Stop, "a b").is_err());
        assert!(run_action(Target::Pc, Act::Stop, "a b").is_err());
        assert!(run_action(Target::Pc, Act::Reboot, "").is_err());
        assert!(run_query(Target::Pc, Query::Updates).is_err());
        assert!(run_logs(Target::Ssh("example-server"), Priority::All, Some("a b")).is_err());
    }

    #[test]
    fn command_shapes() {
        let c = command(Target::Ssh("example-server"), "echo hi", "");
        let last = c
            .get_args()
            .last()
            .map(|a| a.to_string_lossy().into_owned());
        assert_eq!(last.as_deref(), Some("echo hi"));
        assert_eq!(command(Target::Pc, "", "x").get_program(), "powershell");
    }
}
