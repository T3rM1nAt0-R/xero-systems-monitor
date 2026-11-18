//! Probe text in, typed `Reading` out. A line that cannot be read is skipped; the rest of the frame still counts.

mod battery;
mod cpu;
mod disk;
mod docker;
mod drives;
mod extras;
mod gpu;
mod hardware;
mod memory;
mod net;
mod runners;
mod services;
mod top;
mod updates;

use crate::reading::{HardwareInfo, Reading};
pub use battery::parse_windows_battery;

/// Percent scale.
const PERCENT: f64 = 100.0;
/// Bytes in a kibibyte (`/proc/meminfo` counts in these).
const BYTES_PER_KIB: u64 = 1024;
/// Bytes in a mebibyte (`df`, `nvidia-smi` and the process list count in these).
pub(crate) const BYTES_PER_MIB: u64 = 1024 * BYTES_PER_KIB;

/// A byte count as f64.
// reason: byte counts stay far below 2^53, where f64 is exact
#[allow(clippy::cast_precision_loss)]
pub(crate) fn to_f64(n: u64) -> f64 {
    n as f64
}

/// `part` as a percent of `whole`; `None` when `whole` is 0.
pub(crate) fn percent_of(part: u64, whole: u64) -> Option<f64> {
    (whole > 0).then(|| PERCENT * to_f64(part) / to_f64(whole))
}

/// The tag and the rest of a probe line. The one place that splits lines.
fn split_tag(line: &str) -> (&str, &str) {
    line.split_once(char::is_whitespace)
        .map_or((line, ""), |(tag, rest)| (tag, rest.trim_start()))
}

/// Turn one frame of probe text into a `Reading`. Rates (CPU load, network speed)
/// need the counters of `previous`; hardware names and the program list, which the
/// probe sends only now and then, are kept from `previous` when this frame has none.
#[must_use]
pub fn parse_frame(text: &str, previous: Option<&Reading>) -> Reading {
    let mut r = Reading::default();
    let mut temps = Vec::new();
    for line in text.lines().map(str::trim) {
        let (tag, rest) = split_tag(line);
        match tag {
            "cpu" => cpu::line(&mut r, rest),
            t if t.starts_with("cpu") && t.len() > "cpu".len() => cpu::core(&mut r, rest),
            "TEMPS" => cpu::temp(&mut temps, rest),
            "MEM" => memory::line(&mut r, rest),
            "DISK" | "DF" => disk::line(tag, &mut r, rest),
            "NET" => net::line(&mut r, rest),
            "PING" => rest.parse().ok().map(|ms| r.ping_ms = Some(ms)),
            "GPU" => gpu::line(&mut r, rest),
            "RUNNER" | "JOB" | "JOBRES" | "JRES" => runners::line(tag, &mut r, rest),
            "DOCK" | "DOCKON" | "DOCKERR" => docker::line(tag, &mut r, rest),
            "ADAPTER" | "DISKIO" | "SMART" | "SMARTNOTE" => drives::line(tag, &mut r, rest),
            "SVCF" => services::line(&mut r, rest),
            "TOP" => top::line(&mut r, rest),
            "BAT" => battery::line(&mut r, rest),
            "FAN" => extras::fan(&mut r, rest),
            "CTEMP" => extras::core_temp(&mut r, rest),
            "MHZ" => extras::clock(&mut r, rest),
            "GPUAPP" => extras::gpu_app(&mut r, rest),
            "HW" => hardware::line(&mut r, rest),
            "REBOOT" | "UPDATES" => updates::line(tag, &mut r, rest),
            _ => None,
        };
    }
    r.cpu_temp_c = cpu::hottest(&temps);
    if let Some(p) = previous {
        if let (Some(now), Some(before)) = (r.cpu.as_mut(), p.cpu.as_ref()) {
            cpu::rate(now, before);
        }
        if let (Some(now), Some(before)) = (r.net.as_mut(), p.net.as_ref()) {
            net::rate(now, before);
        }
        if r.drive_health.is_empty() && r.health_note.is_none() {
            r.drive_health.clone_from(&p.drive_health);
            r.health_note.clone_from(&p.health_note);
        }
        if r.adapters.is_empty() {
            r.adapters.clone_from(&p.adapters);
        }
        if r.top.is_empty() {
            r.top.clone_from(&p.top);
        }
        if r.gpu_apps.is_none() {
            r.gpu_apps.clone_from(&p.gpu_apps);
        }
        if r.hardware == HardwareInfo::default() {
            r.hardware = p.hardware.clone();
        }
        if r.updates.pending.is_none() {
            r.updates.pending = p.updates.pending;
        }
    }
    r
}
