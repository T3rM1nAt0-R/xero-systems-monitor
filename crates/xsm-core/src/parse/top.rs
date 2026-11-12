//! `TOP cpu_pct ram_mb count name`.

use super::BYTES_PER_MIB;
use crate::reading::{Reading, TopProgram};

/// Words of a `TOP` line after the tag; the name is last and may hold spaces.
const TOP_WORDS: usize = 4;

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let [cpu, ram, count, name] = rest.splitn(TOP_WORDS, ' ').collect::<Vec<_>>()[..] else {
        return None;
    };
    r.top.push(TopProgram {
        name: name.trim().to_owned(),
        cpu_pct: cpu.parse().ok()?,
        ram_bytes: ram.parse::<u64>().ok()? * BYTES_PER_MIB,
        processes: count.parse().ok()?,
    });
    Some(())
}
