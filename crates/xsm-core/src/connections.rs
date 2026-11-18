//! Open network connections per program: reading the owner-pid tables Windows hands out
//! and adding the connections up by program name. Pure: the caller fetches the bytes and looks up names.

use crate::reading::ConnCount;
use std::collections::HashMap;

/// Bytes of the entry count at the start of a table, and of a process id.
const WORD: usize = 4;
/// Bytes of one TCP row (IPv4) with its owning process: state, 2 addresses, 2 ports, pid.
pub const TCP4_ROW: usize = 24;
/// Bytes of one TCP row (IPv6) with its owning process.
pub const TCP6_ROW: usize = 56;
/// Bytes of one UDP row (IPv4) with its owning process: address, port, pid.
pub const UDP4_ROW: usize = 12;
/// Bytes of one UDP row (IPv6) with its owning process.
pub const UDP6_ROW: usize = 28;

/// The owning process ids of every row of a table: a little-endian entry count, then `row_bytes`-sized
/// rows that each end with the pid. A short or damaged table gives the rows that are fully there.
#[must_use]
pub fn pids_in_table(table: &[u8], row_bytes: usize) -> Vec<u32> {
    let word = |at: usize| {
        table
            .get(at..at + WORD)
            .and_then(|b| <[u8; WORD]>::try_from(b).ok())
            .map(u32::from_le_bytes)
    };
    let Some(count) = word(0) else {
        return Vec::new();
    };
    let count = usize::try_from(count).unwrap_or(usize::MAX);
    (0..count)
        .map_while(|i| {
            let end = i.checked_mul(row_bytes)?.checked_add(WORD + row_bytes)?;
            word(end - WORD)
        })
        .collect()
}

/// Connections added up by program name, most first (ties by name), at most `keep` programs.
/// `name_of` gives a process id's program name; ids it does not know (gone, or no access) are skipped.
#[must_use]
pub fn by_program(
    pids: &[u32],
    name_of: impl Fn(u32) -> Option<String>,
    keep: usize,
) -> Vec<ConnCount> {
    let mut by_name: HashMap<String, u32> = HashMap::new();
    for pid in pids {
        if let Some(name) = name_of(*pid) {
            *by_name.entry(name).or_default() += 1;
        }
    }
    let mut all: Vec<ConnCount> = by_name
        .into_iter()
        .map(|(name, count)| ConnCount { name, count })
        .collect();
    all.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));
    all.truncate(keep);
    all
}
