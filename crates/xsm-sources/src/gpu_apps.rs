//! Which programs use this PC's graphics card, from NVML (NVIDIA only), and the battery of a Windows laptop.

use crate::hide_window;
use nvml_wrapper::enums::device::UsedGpuMemory;
use nvml_wrapper::Nvml;
use std::process::Command;
use sysinfo::{Pid, System};
use xsm_core::reading::{BatteryReading, GpuApp};

/// The one PowerShell command that prints the battery as `charge status minutes`.
const BATTERY_COMMAND: &str = "Get-CimInstance Win32_Battery | Select-Object -First 1 | ForEach-Object { \"$($_.EstimatedChargeRemaining) $($_.BatteryStatus) $($_.EstimatedRunTime)\" }";

/// Programs with a process on the first graphics card, processes of one name added together.
/// Memory the driver does not report counts as 0. `None` when NVML cannot say.
pub(crate) fn gpu_apps(nvml: &Nvml, sys: &System) -> Option<Vec<GpuApp>> {
    let dev = nvml.device_by_index(0).ok()?;
    let mut all = dev.running_graphics_processes().unwrap_or_default();
    all.extend(dev.running_compute_processes().unwrap_or_default());
    let mut seen = Vec::new();
    let mut apps = Vec::new();
    for p in all {
        if seen.contains(&p.pid) {
            continue;
        }
        seen.push(p.pid);
        let bytes = match p.used_gpu_memory {
            UsedGpuMemory::Used(b) => b,
            UsedGpuMemory::Unavailable => 0,
        };
        if let Some(proc) = sys.process(Pid::from_u32(p.pid)) {
            GpuApp::add(
                &mut apps,
                &proc.name().to_string_lossy().replace(' ', "_"),
                bytes,
            );
        }
    }
    apps.sort_by(|a, b| b.vram_bytes.cmp(&a.vram_bytes).then(a.name.cmp(&b.name)));
    Some(apps)
}

/// The battery of this PC (a slow PowerShell call, so ask rarely); `None` off Windows or without a battery.
pub(crate) fn windows_battery() -> Option<BatteryReading> {
    if !cfg!(windows) {
        return None;
    }
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", BATTERY_COMMAND]);
    hide_window(&mut cmd);
    let out = cmd.output().ok()?;
    xsm_core::parse::parse_windows_battery(&String::from_utf8_lossy(&out.stdout))
}
