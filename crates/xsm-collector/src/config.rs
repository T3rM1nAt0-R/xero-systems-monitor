//! Reading and writing the files: the settings (`collector.json`, `limits.json`) and `machines.json`.
//! The settings parser itself is pure (`xsm-settings`); the file reading happens here.

use crate::machines::{MachineConfig, MachineKind};
use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use xsm_core::alerts::AlertLimits;
use xsm_settings::{LimitSettings, Settings};

const COLLECTOR_FILE: &str = "collector.json";
const LIMITS_FILE: &str = "limits.json";
const DEFAULT_COLLECTOR: &str = include_str!("../../../settings/collector.json");
const DEFAULT_LIMITS: &str = include_str!("../../../settings/limits.json");
/// The name of the machine list in the data folder.
pub(crate) const MACHINES_FILE: &str = "machines.json";

/// The text of one file, or `fallback` when the file is not there.
fn text_or(dir: Option<&Path>, file: &str, fallback: &str) -> Result<String, String> {
    let Some(dir) = dir else {
        return Ok(fallback.to_owned());
    };
    match fs::read(dir.join(file)) {
        Ok(bytes) => String::from_utf8(bytes).map_err(|e| format!("{file}: {e}")),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(fallback.to_owned()),
        Err(e) => Err(format!("{file}: {e}")),
    }
}

/// The settings from `dir` (a missing file or no folder means the built-in defaults).
pub(crate) fn load_settings(dir: Option<&Path>) -> Result<Settings, String> {
    let collector = text_or(dir, COLLECTOR_FILE, DEFAULT_COLLECTOR)?;
    let limits = text_or(dir, LIMITS_FILE, DEFAULT_LIMITS)?;
    Settings::from_json(&collector, &limits).map_err(|e| e.to_string())
}

/// The alert thresholds the alert detectors take, from the settings.
#[must_use]
pub fn alert_limits(limits: &LimitSettings) -> AlertLimits {
    AlertLimits {
        cpu_pct: f64::from(limits.cpu_pct),
        mem_pct: f64::from(limits.mem_pct),
        disk_pct: f64::from(limits.disk_pct),
        gpu_temp_c: f64::from(limits.gpu_temp_c),
        cpu_temp_c: f64::from(limits.cpu_temp_c),
    }
}

/// Just this PC: the list a first run starts with.
fn default_machines() -> Vec<MachineConfig> {
    vec![MachineConfig {
        name: "This PC".to_owned(),
        kind: MachineKind::Local,
        host: None,
        runner: None,
        was: None,
    }]
}

/// The saved machine list; a first run writes and returns the default one.
pub(crate) fn load_machines(path: &Path) -> Result<Vec<MachineConfig>, String> {
    let list = match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|e| format!("{}: {e}", path.display()))
            .and_then(|l: Vec<MachineConfig>| MachineConfig::check_list(&l).map(|()| l))?,
        Err(e) if e.kind() == ErrorKind::NotFound => {
            let list = default_machines();
            save_machines(path, &list)?;
            list
        }
        Err(e) => return Err(format!("{}: {e}", path.display())),
    };
    Ok(list)
}

/// Write the machine list.
pub(crate) fn save_machines(path: &Path, list: &[MachineConfig]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("{}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_when_no_folder_or_no_file() {
        let a = load_settings(None).unwrap();
        let b = load_settings(Some(Path::new("/nonexistent-xsm-dir"))).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.collector.poll_seconds, 3);
    }

    #[test]
    fn limits_become_alert_limits() {
        let s = load_settings(None).unwrap();
        let a = alert_limits(&s.limits);
        assert!((a.cpu_pct - 90.0).abs() < f64::EPSILON);
        assert!((a.gpu_temp_c - 85.0).abs() < f64::EPSILON);
    }
}
