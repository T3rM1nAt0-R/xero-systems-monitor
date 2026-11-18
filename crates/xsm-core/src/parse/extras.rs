//! `FAN rpm`, `CTEMP core millidegrees`, `MHZ average` (Linux) and `GPUAPP megabytes pid name`.

use super::BYTES_PER_MIB;
use crate::reading::{GpuApp, Reading, SensorDetail};

/// Sensors report thousandths of a degree.
const MILLIDEGREES: f64 = 1000.0;
/// Core temperatures outside this range (degrees Celsius) are broken sensors.
const SENSOR_RANGE_C: std::ops::RangeInclusive<f64> = 5.0..=120.0;
/// Words of a `GPUAPP` line after the tag; the name is last.
const APP_WORDS: usize = 3;
/// The word that says the probe asked for GPU programs and found none.
const NO_APPS: &str = "-";

fn detail(r: &mut Reading) -> &mut SensorDetail {
    r.sensors.get_or_insert_with(SensorDetail::default)
}

pub(super) fn fan(r: &mut Reading, rest: &str) -> Option<()> {
    let rpm: f64 = rest.trim().parse().ok()?;
    if rpm > 0.0 {
        detail(r).fans_rpm.push(rpm);
    }
    Some(())
}

pub(super) fn core_temp(r: &mut Reading, rest: &str) -> Option<()> {
    let (core, milli) = rest.trim().split_once(' ')?;
    let _: u32 = core.parse().ok()?;
    let degrees = milli.trim().parse::<f64>().ok()? / MILLIDEGREES;
    if SENSOR_RANGE_C.contains(&degrees) {
        detail(r).core_temp_c.push(degrees);
    }
    Some(())
}

pub(super) fn clock(r: &mut Reading, rest: &str) -> Option<()> {
    detail(r).cpu_clock_mhz = Some(rest.trim().parse().ok()?);
    Some(())
}

pub(super) fn gpu_app(r: &mut Reading, rest: &str) -> Option<()> {
    let apps = r.gpu_apps.get_or_insert_with(Vec::new);
    if rest.trim() == NO_APPS {
        return Some(());
    }
    let [mib, _pid, name] = rest.splitn(APP_WORDS, ' ').collect::<Vec<_>>()[..] else {
        return None;
    };
    let vram_bytes = mib.parse::<u64>().ok()? * BYTES_PER_MIB;
    GpuApp::add(apps, name.trim(), vram_bytes);
    Some(())
}
