//! `PROC pid cpu_pct ram_mb user name`.

use super::BYTES_PER_MIB;
use crate::reading::{ProcessRow, Reading};

/// Words of a `PROC` line after the tag; the name is last and may hold spaces.
const PROC_WORDS: usize = 5;
/// What the probe prints when it cannot tell who runs a process.
const UNKNOWN_USER: &str = "-";

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let [pid, cpu, ram, user, name] = rest.splitn(PROC_WORDS, ' ').collect::<Vec<_>>()[..] else {
        return None;
    };
    r.processes.push(ProcessRow {
        pid: pid.parse().ok()?,
        name: name.trim().to_owned(),
        cpu_pct: cpu.parse().ok()?,
        ram_bytes: ram.parse::<u64>().ok()? * BYTES_PER_MIB,
        user: if user == UNKNOWN_USER {
            String::new()
        } else {
            user.to_owned()
        },
    });
    Some(())
}
