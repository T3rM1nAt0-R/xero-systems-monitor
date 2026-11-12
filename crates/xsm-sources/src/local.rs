//! Readings for the PC this runs on: `sysinfo`, NVML, `LibreHardwareMonitor` and the system `ping`.

use crate::sensors::{cpu_temp, ping_once};
use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
use nvml_wrapper::Nvml;
use std::collections::HashMap;
use std::time::Instant;
use sysinfo::{Disks, Motherboard, Networks, ProcessesToUpdate, System};
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

#[cfg(test)]
mod tests {
    use super::*;

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
