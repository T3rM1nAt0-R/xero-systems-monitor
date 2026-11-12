//! CPU temperature (system sensors, `LibreHardwareMonitor`, Windows thermal zone) and the system `ping`.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::Duration;
use sysinfo::Components;

/// Public resolver to ping.
const PING_TARGET: &str = "1.1.1.1";
/// `LibreHardwareMonitor`'s local web server.
const LHM_ADDR: ([u8; 4], u16) = ([127, 0, 0, 1], 8085);
/// Seconds to wait for `LibreHardwareMonitor` before saying there is no temperature.
const LHM_TIMEOUT_MS: u64 = 500;
/// `LibreHardwareMonitor` sensor names that hold the CPU temperature, best first.
const LHM_CPU_SENSORS: [&str; 2] = ["Core (Tctl/Tdie)", "CPU Package"];
/// The Windows thermal zone (a slow PowerShell call) is read on the 1st poll and every this many polls.
const ACPI_EVERY_POLLS: u32 = 30;
/// The one PowerShell command that lists the ACPI thermal zones (tenths of Kelvin, one per line).
const ACPI_COMMAND: &str = "(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature).CurrentTemperature";
/// Tenths of Kelvin per Kelvin.
const TENTHS: f64 = 10.0;
/// Zero degrees Celsius in Kelvin.
const KELVIN_AT_0C: f64 = 273.15;
/// Sensor labels (lower case) that belong to the CPU.
const CPU_LABELS: [&str; 5] = ["cpu", "core", "tctl", "tdie", "package"];
/// Temperatures outside this range (degrees Celsius) are broken sensors.
const SENSOR_RANGE_C: std::ops::RangeInclusive<f64> = 5.0..=120.0;

/// Hottest CPU sensor: the system sensors, then on Windows `LibreHardwareMonitor`, then the
/// ACPI thermal zone. `polls` counts polls so far and `acpi_cache` keeps the last thermal-zone
/// answer between the rare calls that ask Windows.
pub(crate) fn cpu_temp(polls: u32, acpi_cache: &mut Option<f64>) -> Option<f64> {
    let from_system = Components::new_with_refreshed_list()
        .ok()
        .and_then(|components| {
            components
                .iter()
                .filter(|c| {
                    CPU_LABELS
                        .iter()
                        .any(|l| c.label().to_lowercase().contains(l))
                })
                .filter_map(|c| c.temperature().map(f64::from))
                .filter(|t| SENSOR_RANGE_C.contains(t))
                .fold(None, |best: Option<f64>, t| {
                    Some(best.map_or(t, |b| b.max(t)))
                })
        });
    if !cfg!(windows) {
        return from_system;
    }
    from_system.or_else(lhm_cpu_temp).or_else(|| {
        if polls.is_multiple_of(ACPI_EVERY_POLLS) {
            *acpi_cache = acpi_cpu_temp();
        }
        *acpi_cache
    })
}

/// Ask Windows (WMI, through one hidden PowerShell) for the ACPI thermal zones.
fn acpi_cpu_temp() -> Option<f64> {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", ACPI_COMMAND]);
    crate::hide_window(&mut cmd);
    let out = cmd.output().ok()?;
    parse_acpi_temps(&String::from_utf8_lossy(&out.stdout))
}

/// Hottest sane temperature in degrees Celsius from the thermal-zone output: one number per
/// line in tenths of Kelvin (e.g. `3182` is 45.05 C). Values outside the sane range are dropped.
#[must_use]
pub fn parse_acpi_temps(text: &str) -> Option<f64> {
    text.lines()
        .filter_map(|line| line.trim().parse::<f64>().ok())
        .map(|tenths| tenths / TENTHS - KELVIN_AT_0C)
        .filter(|c| SENSOR_RANGE_C.contains(c))
        .fold(None, |best: Option<f64>, t| {
            Some(best.map_or(t, |b| b.max(t)))
        })
}

/// Ask `LibreHardwareMonitor`'s local web server; `None` when it is not running.
fn lhm_cpu_temp() -> Option<f64> {
    let timeout = Duration::from_millis(LHM_TIMEOUT_MS);
    let mut s = TcpStream::connect_timeout(&SocketAddr::from(LHM_ADDR), timeout).ok()?;
    s.set_read_timeout(Some(timeout)).ok()?;
    s.write_all(b"GET /data.json HTTP/1.0\r\nHost: localhost\r\n\r\n")
        .ok()?;
    let mut text = String::new();
    s.read_to_string(&mut text).ok()?;
    parse_lhm_cpu_temp(&text)
}

/// The text of the string value that follows `"key"` in JSON text, from `from` on.
fn string_after<'a>(text: &'a str, key: &str, from: usize) -> Option<(&'a str, usize)> {
    let at = from + text[from..].find(&format!("\"{key}\""))? + key.len() + 2;
    let rest = text[at..]
        .trim_start()
        .strip_prefix(':')?
        .trim_start()
        .strip_prefix('"')?;
    let end = rest.find('"')?;
    Some((&rest[..end], text.len() - rest.len() + end))
}

/// CPU temperature in degrees Celsius from `LibreHardwareMonitor`'s `data.json` text.
/// A scan, not a JSON parser (this block may not use `serde_json`): finds a sensor node
/// named like the CPU and reads the `Value` that follows, e.g. `"45,5 °C"`.
#[must_use]
pub fn parse_lhm_cpu_temp(text: &str) -> Option<f64> {
    LHM_CPU_SENSORS.iter().find_map(|sensor| {
        let mut from = 0;
        while let Some((name, end)) = string_after(text, "Text", from) {
            from = end;
            if name != *sensor {
                continue;
            }
            let (value, _) = string_after(text, "Value", end)?;
            let number = value.split_whitespace().next()?.replace(',', ".");
            return value.ends_with('C').then(|| number.parse().ok()).flatten();
        }
        None
    })
}

/// Round trip in milliseconds from the output of the system `ping`, e.g. `time=12.3 ms` or `time<1ms`.
#[must_use]
pub fn parse_ping_ms(text: &str) -> Option<f64> {
    let at = text.find("time=").or_else(|| text.find("time<"))? + "time=".len();
    let number: String = text[at..]
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    number.parse().ok()
}

/// Run the system `ping` once; `None` when it is missing, fails or says nothing readable.
pub(crate) fn ping_once() -> Option<f64> {
    let mut cmd = Command::new("ping");
    if cfg!(windows) {
        cmd.args(["-n", "1", "-w", "1000"]);
    } else {
        cmd.args(["-c", "1", "-W", "1"]);
    }
    cmd.arg(PING_TARGET);
    crate::hide_window(&mut cmd);
    let out = cmd.output().ok()?;
    parse_ping_ms(&String::from_utf8_lossy(&out.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    const LHM: &str = r#"{"id":0,"Text":"Sensor","Children":[{"id":1,"Text":"Example CPU","Children":[
        {"id":2,"Text":"Temperatures","Children":[
        {"id":3,"Text":"Core #1","Value":"41,0 °C","Children":[]},
        {"id":4,"Text":"Core (Tctl/Tdie)","Min":"30,0 °C","Value":"45,5 °C","Max":"70,0 °C"}]}]}]}"#;

    #[test]
    fn reads_lhm_temperature() {
        assert_eq!(parse_lhm_cpu_temp(LHM), Some(45.5));
        let intel = r#"{"Text": "CPU Package", "Value": "52.0 °C"}"#;
        assert_eq!(parse_lhm_cpu_temp(intel), Some(52.0));
    }

    #[test]
    fn lhm_without_a_cpu_sensor_or_value_is_none() {
        assert_eq!(
            parse_lhm_cpu_temp(r#"{"Text":"Fan","Value":"900 RPM"}"#),
            None
        );
        assert_eq!(
            parse_lhm_cpu_temp(r#"{"Text":"Core (Tctl/Tdie)","Value":"900 RPM"}"#),
            None
        );
        assert_eq!(parse_lhm_cpu_temp(r#"{"Text":"Core (Tctl/Tdie)"}"#), None);
        assert_eq!(parse_lhm_cpu_temp("not json"), None);
    }

    #[test]
    fn reads_acpi_thermal_zones() {
        let t = parse_acpi_temps("3182\r\n3032\r\n").unwrap_or_default();
        assert!((t - 45.05).abs() < 1e-6, "{t}");
        assert!(parse_acpi_temps("2732\n").is_none(), "0 C is a broken zone");
        assert_eq!(parse_acpi_temps("0\n99999\n"), None);
        assert_eq!(parse_acpi_temps("2732\n3182\n").map(f64::round), Some(45.0));
        assert_eq!(parse_acpi_temps("Get-CimInstance : denied\n"), None);
        assert_eq!(parse_acpi_temps(""), None);
    }

    #[test]
    fn reads_ping_output() {
        let linux = "64 bytes from 192.0.2.1: icmp_seq=1 ttl=57 time=12.3 ms\n";
        let windows = "Reply from 192.0.2.1: bytes=32 time=14ms TTL=57\r\n";
        let fast = "Reply from 192.0.2.1: bytes=32 time<1ms TTL=57\r\n";
        assert_eq!(parse_ping_ms(linux), Some(12.3));
        assert_eq!(parse_ping_ms(windows), Some(14.0));
        assert_eq!(parse_ping_ms(fast), Some(1.0));
        assert_eq!(parse_ping_ms("Request timed out."), None);
        assert_eq!(parse_ping_ms("time="), None);
    }
}
