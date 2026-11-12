//! What deserves a pop-up. Pure detectors: the caller decides what is new
//! (snooze, "already shown" and the first-load mark live in the window).

use crate::forecast::Forecast;
use crate::parse::percent_of;
use crate::tracker::{Event, FinishedJob, Snapshot, FLAP_PHRASE};
use serde::Serialize;

/// A disk that fills within this many days is worth a warning.
const DISK_DAYS: f64 = 14.0;
/// The job result that means failure.
const FAILED: &str = "Failed";

/// Alert thresholds, filled in by the collector from the settings.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AlertLimits {
    /// CPU use, percent.
    pub cpu_pct: f64,
    /// Memory use, percent.
    pub mem_pct: f64,
    /// Disk use, percent.
    pub disk_pct: f64,
    /// GPU temperature, degrees Celsius.
    pub gpu_temp_c: f64,
    /// CPU temperature, degrees Celsius.
    pub cpu_temp_c: f64,
}

/// What kind of trouble an alert is about.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertKind {
    /// A reading is above its limit.
    Limit,
    /// A disk is nearly full or will be soon.
    DiskFull,
    /// A container keeps restarting.
    Flapping,
    /// A runner job failed.
    FailedJob,
    /// A container or systemd unit is failing.
    FailedService,
}

/// One thing to tell the person.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Alert {
    /// What it is about.
    pub kind: AlertKind,
    /// Machine name.
    pub machine: String,
    /// The message.
    pub text: String,
}

fn alert(kind: AlertKind, machine: &str, text: String) -> Alert {
    Alert {
        kind,
        machine: machine.to_owned(),
        text,
    }
}

/// Alerts that hold right now for one machine: readings over their limits, a nearly
/// full disk (or a forecast that fills it soon), failing containers and failed units.
/// An unreachable machine has none.
#[must_use]
pub fn check(snap: &Snapshot, limits: &AlertLimits, forecast: Option<&Forecast>) -> Vec<Alert> {
    let (m, r) = (snap.name.as_str(), &snap.latest);
    if snap.err.is_some() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let readings = [
        (
            "CPU",
            r.cpu.as_ref().and_then(|c| c.usage_pct),
            limits.cpu_pct,
            "%",
        ),
        (
            "Memory",
            r.memory.as_ref().map(|x| x.used_pct),
            limits.mem_pct,
            "%",
        ),
        (
            "GPU temperature",
            r.gpu.as_ref().map(|g| g.temp_c),
            limits.gpu_temp_c,
            " C",
        ),
        ("CPU temperature", r.cpu_temp_c, limits.cpu_temp_c, " C"),
    ];
    for (what, value, limit, unit) in readings {
        if let Some(v) = value.filter(|v| *v > limit) {
            out.push(alert(
                AlertKind::Limit,
                m,
                format!("{what} is {v:.0}{unit} (limit {limit:.0}{unit})"),
            ));
        }
    }
    let fullest = r
        .disks
        .iter()
        .filter_map(|d| Some((d, percent_of(d.used_bytes, d.total_bytes)?)))
        .filter(|(_, pct)| *pct > limits.disk_pct)
        .max_by(|a, b| a.1.total_cmp(&b.1));
    let days = forecast.and_then(|f| f.days).filter(|d| *d <= DISK_DAYS);
    if let Some((d, pct)) = fullest {
        out.push(alert(
            AlertKind::DiskFull,
            m,
            format!("Disk {} is {pct:.0}% full", d.mount),
        ));
    } else if let Some(days) = days {
        let s = if (days - 1.0).abs() < f64::EPSILON {
            ""
        } else {
            "s"
        };
        out.push(alert(
            AlertKind::DiskFull,
            m,
            format!("Disk fills in about {days} day{s} at the current pace"),
        ));
    }
    for c in r.containers.iter().flatten().filter(|c| c.is_failing()) {
        out.push(alert(
            AlertKind::FailedService,
            m,
            format!("Container {} is {}", c.name, c.state),
        ));
    }
    for u in &r.failed_services {
        out.push(alert(
            AlertKind::FailedService,
            m,
            format!("Service {} failed", u.unit),
        ));
    }
    out
}

/// Jobs that failed and ended after `after` (unix seconds).
#[must_use]
pub fn failed_jobs(rows: &[FinishedJob], after: i64) -> Vec<Alert> {
    let failed = rows.iter().filter(|j| j.end > after && j.result == FAILED);
    failed
        .map(|j| {
            alert(
                AlertKind::FailedJob,
                &j.machine,
                format!("Job failed on {}: {}", j.runner, j.label),
            )
        })
        .collect()
}

/// Containers that keep restarting, from events newer than `after` (unix seconds).
#[must_use]
pub fn flapping(events: &[Event], after: i64) -> Vec<Alert> {
    let new = events
        .iter()
        .filter(|e| e.t > after && e.text.contains(FLAP_PHRASE));
    new.map(|e| {
        alert(
            AlertKind::Flapping,
            &e.machine,
            e.text.split(" (").next().unwrap_or_default().to_owned(),
        )
    })
    .collect()
}
