//! `MEM total_kb available_kb`.

use super::{percent_of, BYTES_PER_KIB};
use crate::reading::{MemoryReading, Reading};

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let (total, available) = rest.split_once(' ')?;
    let total_bytes = total.parse::<u64>().ok()? * BYTES_PER_KIB;
    let available_bytes = available.trim().parse::<u64>().ok()? * BYTES_PER_KIB;
    r.memory = Some(MemoryReading {
        total_bytes,
        available_bytes,
        used_pct: percent_of(total_bytes.saturating_sub(available_bytes), total_bytes)?,
    });
    Some(())
}
