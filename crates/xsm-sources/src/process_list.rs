//! This PC's busiest processes, and ending one process here or on a Linux machine.

use crate::container::{drain_text, wait_for};
use crate::ssh::ssh_command_with;
use std::process::Stdio;
use std::time::Duration;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use xsm_core::reading::ProcessRow;

/// Processes kept in the list.
const ROWS: usize = 50;
/// Longest wait for `kill` over ssh.
const KILL_TIMEOUT: Duration = Duration::from_secs(20);
/// Process ids 0 and 1 are the system itself: never ended from here.
const FIRST_FREE_PID: u32 = 2;

/// The busiest processes by CPU, then memory (processes already refreshed). A process id is
/// what "End task" needs, so these are single processes, not programs.
// reason: byte counts stay far below 2^53; the cpu count is tiny
#[allow(clippy::cast_precision_loss)]
pub(crate) fn process_rows(sys: &System) -> Vec<ProcessRow> {
    let threads = sys.cpus().len().max(1) as f64;
    let mut all: Vec<ProcessRow> = sys
        .processes()
        .iter()
        .map(|(pid, p)| ProcessRow {
            pid: pid.as_u32(),
            name: p.name().to_string_lossy().replace(' ', "_"),
            cpu_pct: f64::from(p.cpu_usage()) / threads,
            ram_bytes: p.memory(),
            user: String::new(),
        })
        .collect();
    all.sort_by(|a, b| {
        b.cpu_pct
            .total_cmp(&a.cpu_pct)
            .then(b.ram_bytes.cmp(&a.ram_bytes))
    });
    all.truncate(ROWS);
    all
}

fn refuse(pid: u32) -> Result<(), String> {
    if pid < FIRST_FREE_PID {
        return Err("That is part of the system and cannot be ended here.".to_owned());
    }
    Ok(())
}

/// End process `pid` on this PC, if it still has the name `name` (so a reused id is never hit).
///
/// # Errors
/// Plain text: a protected id, the program already gone or renamed, or the system refusing.
pub fn end_local(pid: u32, name: &str) -> Result<String, String> {
    refuse(pid)?;
    let mut sys = System::new().map_err(|e| e.to_string())?;
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
        true,
        ProcessRefreshKind::nothing(),
    );
    let shown = name.replace('_', " ");
    let Some(p) = sys.process(Pid::from_u32(pid)) else {
        return Err(format!("{shown} is not running any more."));
    };
    if p.name().to_string_lossy().replace(' ', "_") != name {
        return Err(format!(
            "Process {pid} is not {shown} any more, so nothing was ended."
        ));
    }
    if p.kill() {
        Ok(format!("Ended {shown}."))
    } else {
        Err(format!("Windows did not let this app end {shown}."))
    }
}

/// End process `pid` on `host` with a plain `kill` (the polite TERM signal, never sudo).
///
/// # Errors
/// Plain text: a protected id, ssh failing, the process not being yours, or no answer in time.
pub fn end_remote(host: &str, pid: u32, name: &str) -> Result<String, String> {
    refuse(pid)?;
    let shown = name.replace('_', " ");
    let mut cmd = ssh_command_with(host, &["kill", "-TERM", &pid.to_string()]);
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Could not start ssh on this PC.".to_owned())?;
    let err = child.stderr.take().map(drain_text);
    match wait_for(&mut child, KILL_TIMEOUT) {
        None => Err("The machine did not answer in time.".to_owned()),
        Some(true) => Ok(format!("Asked {shown} to stop.")),
        Some(false) => {
            let why = err.and_then(|h| h.join().ok()).unwrap_or_default();
            Err(format!(
                "Could not end {shown}: {}",
                why.lines()
                    .next()
                    .unwrap_or("kill failed (it may belong to another user).")
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_ids_and_missing_programs_are_refused() {
        assert!(end_local(1, "init").is_err());
        assert!(end_remote("example-server", 0, "x").is_err());
        let gone = end_local(u32::MAX - 1, "no_such").unwrap_err();
        assert!(
            gone.contains("no such") || gone.contains("not running"),
            "{gone}"
        );
    }

    #[test]
    fn the_list_is_busiest_first_and_capped() {
        let mut sys = System::new().unwrap();
        sys.refresh_processes(ProcessesToUpdate::All, true);
        let rows = process_rows(&sys);
        assert!(!rows.is_empty() && rows.len() <= ROWS);
        assert!(rows.windows(2).all(|w| w[0].cpu_pct >= w[1].cpu_pct));
    }
}
