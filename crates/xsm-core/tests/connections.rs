//! Connection tables and the per-program count.

// reason: tests panic on a broken setup, which is how they fail
#![allow(clippy::unwrap_used)]

use xsm_core::connections::{by_program, pids_in_table, TCP4_ROW, UDP4_ROW};

/// A table in Windows' layout: count, then rows of `row` bytes whose last 4 bytes are the pid.
fn table(row: usize, pids: &[u32]) -> Vec<u8> {
    let mut t = u32::try_from(pids.len()).unwrap().to_le_bytes().to_vec();
    for pid in pids {
        t.extend(vec![0xAA; row - 4]);
        t.extend(pid.to_le_bytes());
    }
    t
}

#[test]
fn pids_come_from_the_end_of_each_row() {
    assert_eq!(
        pids_in_table(&table(TCP4_ROW, &[7, 9, 7]), TCP4_ROW),
        [7, 9, 7]
    );
    assert_eq!(pids_in_table(&table(UDP4_ROW, &[5]), UDP4_ROW), [5]);
    assert!(pids_in_table(&table(UDP4_ROW, &[]), UDP4_ROW).is_empty());
}

#[test]
fn a_short_or_empty_table_gives_what_is_fully_there() {
    assert!(pids_in_table(&[], TCP4_ROW).is_empty());
    assert!(pids_in_table(&[1, 0], TCP4_ROW).is_empty());
    let mut t = table(UDP4_ROW, &[1, 2, 3]);
    t.truncate(t.len() - 5); // the third row is cut
    assert_eq!(pids_in_table(&t, UDP4_ROW), [1, 2]);
    let mut lie = u32::MAX.to_le_bytes().to_vec(); // a count far beyond the bytes
    lie.extend(table(UDP4_ROW, &[4])[4..].to_vec());
    assert_eq!(pids_in_table(&lie, UDP4_ROW), [4]);
}

fn names(pid: u32) -> Option<String> {
    match pid {
        1 | 2 => Some("browser".into()),
        3 => Some("editor".into()),
        4 => Some("backup".into()),
        _ => None,
    }
}

#[test]
fn connections_add_up_by_program_most_first() {
    let got = by_program(&[1, 2, 1, 3, 4, 99], names, 8);
    let rows: Vec<_> = got.iter().map(|c| (c.name.as_str(), c.count)).collect();
    assert_eq!(rows, [("browser", 3), ("backup", 1), ("editor", 1)]);
}

#[test]
fn only_the_top_programs_are_kept() {
    let got = by_program(&[1, 3, 4], names, 2);
    assert_eq!(got.len(), 2);
    assert!(by_program(&[], names, 2).is_empty());
}
