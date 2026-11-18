//! Made-up hardware extras for the demo PC: per-core temperatures, a battery and programs using the GPU.

use crate::Ranking;
use std::time::{SystemTime, UNIX_EPOCH};

const GIB: f64 = 1_073_741_824.0;
use xsm_core::reading::{BatteryReading, GpuApp, ProcessRow, Reading};

const MIB: u64 = 1_048_576;
const CORES: u8 = 8;

/// Add the extras to a demo reading that already has sensors; `cpu_pct` and `wave_pct` move the numbers.
pub(crate) fn pc_extras(r: &mut Reading, cpu_pct: f64, wave_pct: f64) {
    if let Some(s) = r.sensors.as_mut() {
        s.core_temp_c = (0..CORES)
            .map(|i| 45.0 + cpu_pct / 4.0 + f64::from(i))
            .collect();
    }
    r.gpu_apps = Some(vec![
        GpuApp {
            name: "game".to_owned(),
            vram_bytes: 5000 * MIB,
            processes: 1,
        },
        GpuApp {
            name: "browser".to_owned(),
            vram_bytes: 800 * MIB,
            processes: 3,
        },
    ]);
    r.battery = Some(BatteryReading {
        charge_pct: 20.0 + wave_pct / 2.0,
        plugged_in: false,
        minutes_left: Some(130),
    });
}

/// Names, share of the machine's CPU and memory (MiB) of the made-up processes.
const PROCESSES: [(&str, f64, u64); 8] = [
    ("browser", 0.30, 1800),
    ("editor", 0.20, 900),
    ("build_tool", 0.15, 600),
    ("video_call", 0.12, 700),
    ("backup", 0.08, 300),
    ("indexer", 0.05, 250),
    ("sync_tool", 0.02, 120),
    ("shell", 0.0, 20),
];
/// Seconds in a minute.
const SECONDS_PER_MINUTE: f64 = 60.0;
/// First made-up process id.
const FIRST_PID: u32 = 1000;

/// Made-up processes sharing `cpu_pct` of the machine.
pub(crate) fn processes(cpu_pct: f64) -> Vec<ProcessRow> {
    (FIRST_PID..)
        .zip(PROCESSES)
        .map(|(pid, (name, share, mib))| ProcessRow {
            pid,
            name: name.to_owned(),
            cpu_pct: cpu_pct * share,
            ram_bytes: mib * MIB,
            user: "user".to_owned(),
        })
        .collect()
}

/// A made-up ranking over `range_s` seconds from the processes of one reading; empty for an unknown machine.
pub(crate) fn ranking(r: Option<&Reading>, range_s: f64) -> Ranking {
    // reason: a range is a few days of seconds, so its minutes fit a u32 (NaN becomes 0)
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let minutes = (range_s / SECONDS_PER_MINUTE).max(0.0) as u32;
    let Some(r) = r else {
        return Ranking {
            minutes: 0,
            top: Vec::new(),
        };
    };
    let top = r
        .processes
        .iter()
        .map(|p| {
            let mib = u32::try_from(p.ram_bytes / MIB).unwrap_or(u32::MAX);
            (p.name.clone(), p.cpu_pct, f64::from(mib), minutes)
        })
        .collect();
    Ranking { minutes, top }
}

/// The demo's answer to "End task": nothing is really ended.
pub(crate) fn end_task(known: bool, name: &str) -> Result<String, String> {
    if known {
        Ok(format!("Demo: {name} was not really ended."))
    } else {
        Err("That machine is not in the list.".to_owned())
    }
}

/// Whole bytes in `gib` gibibytes.
pub(crate) fn bytes(gib: f64) -> u64 {
    // reason: whole bytes are enough for a demo and the input is never negative
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let n = (gib * GIB) as u64;
    n
}

/// Now, unix seconds.
pub(crate) fn now_s() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |d| d.as_secs_f64())
}
