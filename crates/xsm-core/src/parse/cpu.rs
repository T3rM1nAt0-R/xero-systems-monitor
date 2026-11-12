//! `cpu` (the first line of `/proc/stat`) and `TEMPS` lines.

use super::PERCENT;
use crate::reading::{CpuReading, Reading};

/// Counters read from `/proc/stat`: user, nice, system, idle, iowait, irq, softirq, steal.
const TICK_FIELDS: usize = 8;
/// Sensors reading outside this range (degrees Celsius) are broken, not hot.
const SENSOR_RANGE_C: std::ops::RangeInclusive<f64> = 5.0..=120.0;
/// Sensor names that measure the CPU package, best first.
const CPU_SENSORS: [&str; 8] = [
    "coretemp",
    "k10temp",
    "zenpower",
    "cpu_thermal",
    "cpu-thermal",
    "soc_thermal",
    "acpitz",
    "tz-x86_pkg_temp",
];
/// Sensors report thousandths of a degree.
const MILLIDEGREES: f64 = 1000.0;

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let ticks: Vec<f64> = rest
        .split_whitespace()
        .take(TICK_FIELDS)
        .map(str::parse)
        .collect::<Result<_, _>>()
        .ok()?;
    let [_, _, _, idle, iowait, ..] = ticks[..] else {
        return None;
    };
    r.cpu = Some(CpuReading {
        usage_pct: None,
        idle_ticks: idle + iowait,
        total_ticks: ticks.iter().sum(),
    });
    Some(())
}

/// Load between two frames, kept inside 0 to 100.
pub(super) fn rate(now: &mut CpuReading, before: &CpuReading) {
    let total = now.total_ticks - before.total_ticks;
    if total > 0.0 {
        let idle = (now.idle_ticks - before.idle_ticks) / total;
        now.usage_pct = Some((PERCENT * (1.0 - idle)).clamp(0.0, PERCENT));
    }
}

pub(super) fn temp(temps: &mut Vec<(String, f64)>, rest: &str) -> Option<()> {
    let (name, milli) = rest.split_once(' ')?;
    let degrees = milli.trim().parse::<f64>().ok()? / MILLIDEGREES;
    if SENSOR_RANGE_C.contains(&degrees) {
        temps.push((name.to_owned(), degrees));
    }
    Some(())
}

/// The hottest reading of the best CPU sensor, else of any sensor.
pub(super) fn hottest(temps: &[(String, f64)]) -> Option<f64> {
    let max = |keep: &dyn Fn(&str) -> bool| {
        temps
            .iter()
            .filter(|(name, _)| keep(name))
            .map(|&(_, t)| t)
            .reduce(f64::max)
    };
    CPU_SENSORS
        .iter()
        .find_map(|best| max(&|name| name == *best))
        .or_else(|| max(&|_| true))
}
