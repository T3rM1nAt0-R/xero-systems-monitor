//! Named-number settings. Pure: callers read the files and pass the text in.
#![deny(missing_docs)]

use serde::Deserialize;
use std::fmt;

/// Polling and retention settings from `settings/collector.json`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectorSettings {
    /// Seconds between polls.
    pub poll_seconds: u32,
    /// Days of history kept.
    pub history_days: u32,
    /// Seconds to wait before reconnecting a dropped ssh session.
    pub ssh_reconnect_seconds: u32,
    /// Missed polls in a row before a machine counts as offline.
    pub offline_after_misses: u32,
}

/// Alert thresholds from `settings/limits.json`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LimitSettings {
    /// CPU use, percent.
    pub cpu_pct: u32,
    /// Memory use, percent.
    pub mem_pct: u32,
    /// Disk use, percent.
    pub disk_pct: u32,
    /// GPU temperature, degrees Celsius.
    pub gpu_temp_c: u32,
    /// CPU temperature, degrees Celsius.
    pub cpu_temp_c: u32,
}

/// All settings.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Settings {
    /// Polling and retention.
    pub collector: CollectorSettings,
    /// Alert thresholds.
    pub limits: LimitSettings,
}

/// Why settings could not be read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SettingsError {
    /// `collector.json` is bad JSON, has a missing key or has an extra key.
    Collector(String),
    /// `limits.json` is bad JSON, has a missing key or has an extra key.
    Limits(String),
}

impl fmt::Display for SettingsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Collector(why) => write!(f, "collector.json: {why}"),
            Self::Limits(why) => write!(f, "limits.json: {why}"),
        }
    }
}

impl std::error::Error for SettingsError {}

impl Settings {
    /// Parse the text of `collector.json` and `limits.json`.
    ///
    /// # Errors
    /// Returns [`SettingsError`] for bad JSON, a missing key or an unknown key.
    pub fn from_json(collector: &str, limits: &str) -> Result<Settings, SettingsError> {
        let collector =
            serde_json::from_str(collector).map_err(|e| SettingsError::Collector(e.to_string()))?;
        let limits =
            serde_json::from_str(limits).map_err(|e| SettingsError::Limits(e.to_string()))?;
        Ok(Settings { collector, limits })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const COLLECTOR: &str = include_str!("../../../settings/collector.json");
    const LIMITS: &str = include_str!("../../../settings/limits.json");

    #[test]
    fn shipped_files_parse() {
        let s = Settings::from_json(COLLECTOR, LIMITS).unwrap();
        assert_eq!(s.collector.poll_seconds, 3);
        assert_eq!(s.collector.history_days, 365);
        assert_eq!(s.collector.ssh_reconnect_seconds, 10);
        assert_eq!(s.collector.offline_after_misses, 3);
        assert_eq!(s.limits.cpu_pct, 90);
        assert_eq!(s.limits.gpu_temp_c, 85);
        assert_eq!(s.limits.cpu_temp_c, 90);
    }

    #[test]
    fn bad_json_is_an_error() {
        let err = Settings::from_json("{", LIMITS).unwrap_err();
        assert!(matches!(err, SettingsError::Collector(_)));
        let err = Settings::from_json(COLLECTOR, "nope").unwrap_err();
        assert!(matches!(err, SettingsError::Limits(_)));
        assert!(err.to_string().starts_with("limits.json: "));
    }

    #[test]
    fn missing_key_is_an_error() {
        let short = r#"{"poll_seconds": 3}"#;
        let err = Settings::from_json(short, LIMITS).unwrap_err();
        assert!(err.to_string().contains("missing field"));
    }

    #[test]
    fn extra_key_is_rejected() {
        let extra = LIMITS.replace('{', r#"{"surprise": 1,"#);
        let err = Settings::from_json(COLLECTOR, &extra).unwrap_err();
        assert!(err.to_string().contains("unknown field"));
        let extra = COLLECTOR.replace('{', r#"{"surprise": 1,"#);
        assert!(Settings::from_json(&extra, LIMITS).is_err());
    }
}
