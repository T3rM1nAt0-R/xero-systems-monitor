//! The typed reading of one machine at one moment. Unit is in every field name.

use serde::{Deserialize, Serialize};

/// What one probe frame says about a machine. A fact the frame did not carry is `None` or empty.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Reading {
    /// CPU load, with the counters the next frame needs.
    pub cpu: Option<CpuReading>,
    /// Hottest CPU sensor, degrees Celsius.
    pub cpu_temp_c: Option<f64>,
    /// Memory in use.
    pub memory: Option<MemoryReading>,
    /// Root file system used, percent.
    pub disk_used_pct: Option<f64>,
    /// Real file systems (virtual and system mounts are left out).
    pub disks: Vec<DiskReading>,
    /// Network counters and speed of the default route.
    pub net: Option<NetReading>,
    /// First NVIDIA GPU, when there is one.
    pub gpu: Option<GpuReading>,
    /// Round trip to a public resolver, milliseconds.
    pub ping_ms: Option<f64>,
    /// CI runner processes found.
    pub runners: Vec<RunnerState>,
    /// Jobs running now or just finished, one per runner.
    pub jobs: Vec<JobLine>,
    /// Containers; `None` means docker is not installed, empty means no containers.
    pub containers: Option<Vec<ContainerState>>,
    /// Why docker is installed but did not answer (often a permission problem).
    pub docker_error: Option<String>,
    /// Systemd units in the failed state.
    pub failed_services: Vec<FailedService>,
    /// Busiest programs (kept from the last frame that sampled them).
    pub top: Vec<TopProgram>,
    /// Hardware names (kept from the last frame that read them).
    pub hardware: HardwareInfo,
}

/// CPU load from `/proc/stat`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct CpuReading {
    /// Load since the previous frame, percent 0 to 100; `None` on the first frame.
    pub usage_pct: Option<f64>,
    /// Idle plus iowait ticks so far (a counter, exact below 2^53).
    pub idle_ticks: f64,
    /// All ticks so far.
    pub total_ticks: f64,
}

/// Memory from `/proc/meminfo`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MemoryReading {
    /// Installed memory, bytes.
    pub total_bytes: u64,
    /// Memory that programs could still use, bytes.
    pub available_bytes: u64,
    /// Share not available, percent.
    pub used_pct: f64,
}

/// One mounted file system.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DiskReading {
    /// Device name.
    pub device: String,
    /// Where it is mounted.
    pub mount: String,
    /// Size, bytes.
    pub total_bytes: u64,
    /// Used, bytes.
    pub used_bytes: u64,
}

/// The default network route.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct NetReading {
    /// First address of the machine.
    pub ip: Option<String>,
    /// Link speed, megabits per second; `None` when the driver does not say.
    pub link_speed_mbps: Option<u64>,
    /// Bytes received so far (a counter).
    pub rx_bytes: f64,
    /// Bytes sent so far (a counter).
    pub tx_bytes: f64,
    /// Seconds the machine has been up; the time base of the rates (the core has no clock).
    pub uptime_s: f64,
    /// Download rate since the previous frame, bytes per second.
    pub down_bytes_per_s: Option<f64>,
    /// Upload rate since the previous frame, bytes per second.
    pub up_bytes_per_s: Option<f64>,
}

/// An NVIDIA GPU from `nvidia-smi`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct GpuReading {
    /// Core load, percent.
    pub util_pct: f64,
    /// Temperature, degrees Celsius.
    pub temp_c: f64,
    /// Video memory in use, bytes.
    pub vram_used_bytes: u64,
    /// Video memory installed, bytes.
    pub vram_total_bytes: u64,
    /// Video memory in use, percent.
    pub vram_used_pct: f64,
}

/// A CI runner process: idle while only its listener runs, busy while a worker runs.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RunnerState {
    /// Runner folder name.
    pub name: String,
    /// True when a worker process exists.
    pub busy: bool,
}

/// A job on a runner. Empty text means unknown. A line with a `result` and no name is a job that just ended.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct JobLine {
    /// Runner folder name.
    pub runner: String,
    /// Job display name.
    pub name: String,
    /// Repository, `owner/name`.
    pub repo: String,
    /// Git ref, e.g. `refs/pull/7/merge`.
    pub git_ref: String,
    /// Source branch of a pull request.
    pub head_ref: String,
    /// CPU of the job's processes, percent of the whole machine.
    pub cpu_pct: Option<f64>,
    /// Memory of the job's processes, bytes.
    pub ram_bytes: Option<u64>,
    /// GPU memory of the job's processes, bytes.
    pub vram_bytes: Option<u64>,
    /// How the job ended, e.g. `Succeeded` or `Failed`.
    pub result: Option<String>,
    /// Worker log file the result was read from.
    pub result_log: Option<String>,
}

/// One docker container.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ContainerState {
    /// Container name.
    pub name: String,
    /// State word: running, exited, restarting, dead, ...
    pub state: String,
    /// Status text, e.g. `Up 2 hours (unhealthy)`.
    pub status: String,
    /// Image name.
    pub image: String,
    /// Published ports.
    pub ports: String,
    /// How long ago it was created, as docker prints it.
    pub running_for: String,
}

/// Status text of a container that exited, up to its code.
const EXITED_PREFIX: &str = "Exited (";

impl ContainerState {
    /// True for a container that fell over: restarting, dead, exited with a non-zero
    /// code, or failing its health check. A clean exit (code 0) is not a failure.
    #[must_use]
    pub fn is_failing(&self) -> bool {
        let code = self
            .status
            .strip_prefix(EXITED_PREFIX)
            .and_then(|rest| rest.split_once(')'))
            .map(|(code, _)| code)
            .filter(|c| !c.is_empty() && c.bytes().all(|b| b.is_ascii_digit()));
        matches!(self.state.as_str(), "restarting" | "dead")
            || self.status.contains("(unhealthy)")
            || (self.state == "exited" && code.is_some_and(|c| c != "0"))
    }
}

impl JobLine {
    /// True while the job runs: it has a name, or no result yet. A line that carries
    /// only a result is a job that just ended.
    #[must_use]
    pub fn is_running(&self) -> bool {
        self.result.is_none() || !self.name.is_empty()
    }
}

/// A systemd unit in the failed state.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FailedService {
    /// Unit name, e.g. `foo.service`.
    pub unit: String,
}

/// Processes of one program name added together.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TopProgram {
    /// Program name (spaces shown as `_`).
    pub name: String,
    /// CPU, percent of the whole machine.
    pub cpu_pct: f64,
    /// Memory, bytes.
    pub ram_bytes: u64,
    /// How many processes have this name.
    pub processes: u32,
}

/// Hardware names; read rarely.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct HardwareInfo {
    /// CPU model and thread count.
    pub cpu: Option<String>,
    /// GPU model.
    pub gpu: Option<String>,
    /// Operating system.
    pub os: Option<String>,
    /// Board or machine model.
    pub board: Option<String>,
}
