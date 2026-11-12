//! `DISK 42%` (root) and `DF dev size used avail pct mount` lines.

use super::BYTES_PER_MIB;
use crate::reading::{DiskReading, Reading};

/// Mounts that are not storage a person cares about.
const SKIPPED_MOUNTS: [&str; 7] = [
    "/snap",
    "/run",
    "/dev",
    "/sys",
    "/proc",
    "/boot/efi",
    "/var/lib/docker",
];

/// Words between the used size and the mount in a `DF` line: available and percent.
const WORDS_BEFORE_MOUNT: usize = 2;

/// `1000M` as bytes.
fn mebibytes(text: &str) -> Option<u64> {
    Some(text.strip_suffix('M')?.parse::<u64>().ok()? * BYTES_PER_MIB)
}

pub(super) fn line(tag: &str, r: &mut Reading, rest: &str) -> Option<()> {
    if tag == "DISK" {
        r.disk_used_pct = Some(rest.trim_end_matches('%').parse().ok()?);
        return Some(());
    }
    let mut words = rest.split_whitespace();
    let device = words.next()?.to_owned();
    let total_bytes = mebibytes(words.next()?)?;
    let used_bytes = mebibytes(words.next()?)?;
    let mount = words.skip(WORDS_BEFORE_MOUNT).collect::<Vec<_>>().join(" ");
    let skip = SKIPPED_MOUNTS.iter().any(|m| mount.starts_with(m));
    if !mount.is_empty() && !skip && r.disks.iter().all(|d| d.device != device) {
        r.disks.push(DiskReading {
            device,
            mount,
            total_bytes,
            used_bytes,
        });
    }
    Some(())
}
