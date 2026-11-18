//! `BAT pct state minutes` from the Linux probe, and the one line of Windows battery text.

use crate::reading::{BatteryReading, Reading};

/// States (lower case) that mean the cable is in.
const PLUGGED_STATES: [&str; 3] = ["charging", "full", "not_charging"];
/// Windows `BatteryStatus` codes that mean the cable is in (on AC, full, charging, charging high, low, critical).
const WINDOWS_PLUGGED: [u32; 6] = [2, 3, 6, 7, 8, 9];
/// Windows reports this many minutes or more when it does not know the time left.
const WINDOWS_UNKNOWN_MIN: u32 = 100_000;
/// Percent scale.
const MAX_PCT: f64 = 100.0;

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let [pct, state, mins] = rest.split_whitespace().collect::<Vec<_>>()[..] else {
        return None;
    };
    r.battery = Some(BatteryReading {
        charge_pct: pct.parse::<f64>().ok()?.clamp(0.0, MAX_PCT),
        plugged_in: PLUGGED_STATES.contains(&state.to_lowercase().as_str()),
        minutes_left: mins.parse().ok(),
    });
    Some(())
}

/// The battery from Windows text `charge status minutes` (for example `87 2 95`), as printed by
/// the `Win32_Battery` query. `None` when the text holds no battery.
#[must_use]
pub fn parse_windows_battery(text: &str) -> Option<BatteryReading> {
    let first = text.lines().next()?;
    let [pct, status, mins] = first.split_whitespace().collect::<Vec<_>>()[..] else {
        return None;
    };
    Some(BatteryReading {
        charge_pct: pct.parse::<f64>().ok()?.clamp(0.0, MAX_PCT),
        plugged_in: WINDOWS_PLUGGED.contains(&status.parse().ok()?),
        minutes_left: mins.parse().ok().filter(|m: &u32| *m < WINDOWS_UNKNOWN_MIN),
    })
}
