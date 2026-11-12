//! Readings for the PC this runs on: `sysinfo`, NVML, `LibreHardwareMonitor` and the system `ping`.

use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
use nvml_wrapper::Nvml;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::{Duration, Instant};
use sysinfo::{Components, Disks, Motherboard, Networks, ProcessesToUpdate, System};
use xsm_core::reading::{
    CpuReading, DiskReading, GpuReading, HardwareInfo, MemoryReading, NetReading, Reading,
    TopProgram,
};

/// Percent scale.
const PERCENT: f64 = 100.0;
/// The ping runs on the 1st poll and every this many polls after (it costs up to a second).
const PING_EVERY_POLLS: u32 = 5;
/// The program list is rebuilt on the 1st poll and every this many polls.
const TOP_EVERY_POLLS: u32 = 5;
/// Programs kept in the list.
const TOP_COUNT: usize = 6;
/// Public resolver to ping.
const PING_TARGET: &str = "1.1.1.1";
/// `LibreHardwareMonitor`'s local web server.
const LHM_ADDR: ([u8; 4], u16) = ([127, 0, 0, 1], 8085);
/// Seconds to wait for `LibreHardwareMonitor` before saying there is no temperature.
const LHM_TIMEOUT_MS: u64 = 500;
/// `LibreHardwareMonitor` sensor names that hold the CPU temperature, best first.
const LHM_CPU_SENSORS: [&str; 2] = ["Core (Tctl/Tdie)", "CPU Package"];
/// Sensor labels (lower case) that belong to the CPU.
const CPU_LABELS: [&str; 5] = ["cpu", "core", "tctl", "tdie", "package"];
/// Temperatures outside this range (degrees Celsius) are broken sensors.
const SENSOR_RANGE_C: std::ops::RangeInclusive<f64> = 5.0..=120.0;
/// File systems that are not real storage.
const VIRTUAL_FS: [&str; 6] = [
    "tmpfs", "devtmpfs", "squashfs", "overlay", "efivarfs", "ramfs",
];
/// Network interfaces that carry no outside traffic.
const LOOPBACK: [&str; 2] = ["lo", "Loopback"];

/// Everything needed to read this PC again and again. Rates need two polls, so keep one around.
pub struct LocalSource {
    sys: System,
    disks: Disks,
    networks: Networks,
    nvml: Option<Nvml>,
    polls: u32,
    last_net: Option<(Instant, f64, f64)>,
    ping_ms: Option<f64>,
    top: Vec<TopProgram>,
    hardware: HardwareInfo,
}

impl LocalSource {
    /// Start reading this PC. A missing NVIDIA driver is fine: the GPU part stays empty.
    ///
    /// # Errors
    /// The operating system would not list its processors, disks or network cards.
    pub fn new() -> Result<Self, String> {
        let why = |e: sysinfo::Error| e.to_string();
        let mut sys = System::new().map_err(why)?;
        sys.refresh_cpu_all();
        let nvml = Nvml::init().ok();
        let hardware = hardware_names(&sys, nvml.as_ref());
        Ok(Self {
            sys,
            disks: Disks::new_with_refreshed_list().map_err(why)?,
            networks: Networks::new_with_refreshed_list().map_err(why)?,
            nvml,
            polls: 0,
            last_net: None,
            ping_ms: None,
            top: Vec::new(),
            hardware,
        })
    }

    /// Read this PC now. Call it about every poll interval; the first call has no rates yet.
    pub fn poll(&mut self) -> Reading {
        let first = self.polls == 0;
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();
        self.disks.refresh(true);
        self.networks.refresh(true);
        if self.polls.is_multiple_of(TOP_EVERY_POLLS) {
            self.top = top_programs(&mut self.sys);
        }
        if self.polls.is_multiple_of(PING_EVERY_POLLS) {
            self.ping_ms = ping_once();
        }
        self.polls = self.polls.wrapping_add(1);
        let disks = disk_readings(&self.disks);
        Reading {
            cpu: Some(CpuReading {
                usage_pct: (!first).then(|| f64::from(self.sys.global_cpu_usage())),
                ..CpuReading::default()
            }),
            cpu_temp_c: cpu_temp(),
            memory: memory_reading(&self.sys),
            disk_used_pct: root_used_pct(&self.disks),
            disks,
            net: Some(self.net_reading()),
            gpu: self.nvml.as_ref().and_then(gpu_reading),
            ping_ms: self.ping_ms,
            top: self.top.clone(),
            hardware: self.hardware.clone(),
            ..Reading::default()
        }
    }

    fn net_reading(&mut self) -> NetReading {
        let real = || {
            self.networks
                .iter()
                .filter(|(n, _)| !LOOPBACK.iter().any(|l| n.to_string_lossy().starts_with(l)))
        };
        // reason: byte counters stay far below 2^53, where f64 is exact
        #[allow(clippy::cast_precision_loss)]
        let (rx, tx) = real().fold((0.0, 0.0), |(r, t), (_, d)| {
            (
                r + d.total_received() as f64,
                t + d.total_transmitted() as f64,
            )
        });
        let ip = real()
            .flat_map(|(_, d)| d.ip_networks())
            .find(|n| n.addr.is_ipv4() && !n.addr.is_loopback())
            .map(|n| n.addr.to_string());
        let now = Instant::now();
        let rates = self.last_net.and_then(|(at, prx, ptx)| {
            let secs = now.duration_since(at).as_secs_f64();
            (secs > 0.0).then(|| (((rx - prx) / secs).max(0.0), ((tx - ptx) / secs).max(0.0)))
        });
        self.last_net = Some((now, rx, tx));
        // reason: uptime seconds stay far below 2^53
        #[allow(clippy::cast_precision_loss)]
        let uptime_s = System::uptime().unwrap_or(0) as f64;
        NetReading {
            ip,
            link_speed_mbps: None,
            rx_bytes: rx,
            tx_bytes: tx,
            uptime_s,
            down_bytes_per_s: rates.map(|r| r.0),
            up_bytes_per_s: rates.map(|r| r.1),
        }
    }
}

fn hardware_names(sys: &System, nvml: Option<&Nvml>) -> HardwareInfo {
    let cpu = sys
        .cpus()
        .first()
        .map(|c| format!("{} ({} threads)", c.brand().trim(), sys.cpus().len()));
    HardwareInfo {
        cpu,
        gpu: nvml
            .and_then(|n| n.device_by_index(0).ok())
            .and_then(|d| d.name().ok()),
        os: System::long_os_version().ok(),
        board: Motherboard::new().ok().and_then(|b| b.name()),
    }
}

// reason: byte counts stay far below 2^53, where f64 is exact
#[allow(clippy::cast_precision_loss)]
fn memory_reading(sys: &System) -> Option<MemoryReading> {
    let (total, available) = (sys.total_memory(), sys.available_memory());
    (total > 0).then(|| MemoryReading {
        total_bytes: total,
        available_bytes: available,
        used_pct: PERCENT * total.saturating_sub(available) as f64 / total as f64,
    })
}

fn disk_readings(disks: &Disks) -> Vec<DiskReading> {
    disks
        .iter()
        .filter(|d| d.total_space() > 0)
        .filter(|d| !VIRTUAL_FS.contains(&d.file_system().to_string_lossy().as_ref()))
        .map(|d| DiskReading {
            device: d.name().to_string_lossy().into_owned(),
            mount: d.mount_point().to_string_lossy().into_owned(),
            total_bytes: d.total_space(),
            used_bytes: d.total_space().saturating_sub(d.available_space()),
        })
        .collect()
}

// reason: byte counts stay far below 2^53, where f64 is exact
#[allow(clippy::cast_precision_loss)]
fn root_used_pct(disks: &Disks) -> Option<f64> {
    let root = |d: &&sysinfo::Disk| {
        let m = d.mount_point().to_string_lossy();
        m == "/" || m.starts_with("C:")
    };
    let d = disks.iter().find(root).or_else(|| disks.iter().next())?;
    let total = d.total_space();
    (total > 0).then(|| PERCENT * total.saturating_sub(d.available_space()) as f64 / total as f64)
}

/// Busiest programs by CPU, processes of one name added together.
// reason: byte counts stay far below 2^53; the cpu count is tiny
#[allow(clippy::cast_precision_loss)]
fn top_programs(sys: &mut System) -> Vec<TopProgram> {
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let threads = sys.cpus().len().max(1) as f64;
    let mut by_name: HashMap<String, TopProgram> = HashMap::new();
    for p in sys.processes().values() {
        let name = p.name().to_string_lossy().replace(' ', "_");
        let e = by_name.entry(name.clone()).or_insert_with(|| TopProgram {
            name,
            ..TopProgram::default()
        });
        e.cpu_pct += f64::from(p.cpu_usage()) / threads;
        e.ram_bytes += p.memory();
        e.processes += 1;
    }
    let mut all: Vec<TopProgram> = by_name.into_values().collect();
    all.sort_by(|a, b| {
        b.cpu_pct
            .total_cmp(&a.cpu_pct)
            .then(b.ram_bytes.cmp(&a.ram_bytes))
    });
    all.truncate(TOP_COUNT);
    all
}

/// First NVIDIA GPU; any failure means no reading.
// reason: byte counts stay far below 2^53, where f64 is exact
#[allow(clippy::cast_precision_loss)]
fn gpu_reading(nvml: &Nvml) -> Option<GpuReading> {
    let dev = nvml.device_by_index(0).ok()?;
    let mem = dev.memory_info().ok()?;
    Some(GpuReading {
        util_pct: f64::from(dev.utilization_rates().ok()?.gpu),
        temp_c: f64::from(dev.temperature(TemperatureSensor::Gpu).ok()?),
        vram_used_bytes: mem.used,
        vram_total_bytes: mem.total,
        vram_used_pct: if mem.total > 0 {
            PERCENT * mem.used as f64 / mem.total as f64
        } else {
            0.0
        },
    })
}

/// Hottest CPU sensor: the system sensors, or `LibreHardwareMonitor` on Windows.
/// TODO: WMI thermal-zone fallback on Windows when `LibreHardwareMonitor` is not running.
fn cpu_temp() -> Option<f64> {
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
    from_system.or_else(|| if cfg!(windows) { lhm_cpu_temp() } else { None })
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
fn ping_once() -> Option<f64> {
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

    #[test]
    fn local_smoke_test() {
        let mut src = LocalSource::new().expect("sysinfo works on this box");
        let first = src.poll();
        assert_eq!(first.cpu.as_ref().map(|c| c.usage_pct), Some(None));
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL * 2);
        let r = src.poll();
        let mem = r.memory.expect("memory is always readable");
        assert!(mem.total_bytes > 0 && (0.0..=100.0).contains(&mem.used_pct));
        assert!(r
            .cpu
            .and_then(|c| c.usage_pct)
            .is_some_and(|u| (0.0..=100.0).contains(&u)));
        assert!(r.net.and_then(|n| n.down_bytes_per_s).is_some());
        assert!(r.hardware.cpu.is_some());
        assert!(!r.disks.is_empty());
    }
}
