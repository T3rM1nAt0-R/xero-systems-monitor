//! `GPU util, temp, mem_used_mib, mem_total_mib` or `GPU none`.

use super::{percent_of, BYTES_PER_MIB};
use crate::reading::{GpuReading, Reading};

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let [util, temp, used, total] = rest.split(',').map(str::trim).collect::<Vec<_>>()[..] else {
        return None;
    };
    let (used, total) = (used.parse::<u64>().ok()?, total.parse::<u64>().ok()?);
    r.gpu = Some(GpuReading {
        util_pct: util.parse().ok()?,
        temp_c: temp.parse().ok()?,
        vram_used_bytes: used * BYTES_PER_MIB,
        vram_total_bytes: total * BYTES_PER_MIB,
        vram_used_pct: percent_of(used, total)?,
    });
    Some(())
}
