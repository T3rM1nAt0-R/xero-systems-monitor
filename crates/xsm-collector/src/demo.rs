//! Made-up readings for two machines, so the shell runs end to end before the real collector exists.
//! The numbers follow the same smooth waves as `app/src/fakeData.js`; nothing here is measured.

use crate::history::{History, Series};
use crate::machines::{MachineConfig, MachineKind, MachineList, SaveOutcome};
use crate::{Backend, HistoryReply, State};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use xsm_core::forecast::Forecast;
use xsm_core::reading::{
    CpuReading, DiskReading, GpuReading, HardwareInfo, MemoryReading, NetReading, Reading,
    RunnerState, TopProgram,
};
use xsm_core::tracker::{Event, FinishedJob, Rules, Tracker};

const TAU: f64 = std::f64::consts::TAU;
const DAY_S: f64 = 86_400.0;
const JOB_SLOT_S: i64 = 7_200;
const JOB_LENGTH_S: i64 = 900;
const SERIES_POINTS: f64 = 400.0;
const MIN_STEP_S: f64 = 3.0;
const OFFLINE_AFTER: u32 = 3;
const GIB: f64 = 1_073_741_824.0;
const MIB: u64 = 1_048_576;
const RUNNERS: [&str; 2] = ["runner-1", "runner-2"];
const FORECAST_PER_DAY: f64 = 0.4;
const FORECAST_DAYS: f64 = 95.0;

/// `(base, swing, period in seconds)` of a wave.
type Wave = (f64, f64, f64);
const CPU: Wave = (18.0, 40.0, 900.0);
const RAM: Wave = (48.0, 12.0, 5400.0);
const TEMP: Wave = (46.0, 18.0, 900.0);
const GPU: Wave = (8.0, 45.0, 1300.0);
const GTEMP: Wave = (40.0, 22.0, 1300.0);
const VRAM: Wave = (25.0, 20.0, 3000.0);
const DOWN: Wave = (2e5, 3e6, 700.0);
const UP: Wave = (5e4, 6e5, 500.0);
const PING: Wave = (12.0, 8.0, 300.0);

fn wave((base, swing, period): Wave, phase: f64, t: f64) -> f64 {
    base + swing * (0.5 + 0.5 * (t / period * TAU + phase).sin())
}

fn is_pc(m: &MachineConfig) -> bool {
    m.kind == MachineKind::Local
}

/// A different phase for every machine name.
fn phase_of(name: &str) -> f64 {
    name.bytes()
        .fold(7.0, |a, b| (a * 31.0 + f64::from(b)) % 1000.0)
}

fn bytes(gib: f64) -> u64 {
    // reason: whole bytes are enough for a demo and the input is never negative
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let n = (gib * GIB) as u64;
    n
}

fn reading(m: &MachineConfig, t: f64) -> Reading {
    let phase = phase_of(&m.name);
    let ram_total = if is_pc(m) { 32.0 } else { 64.0 };
    let ram_pct = wave(RAM, phase, t);
    let cpu_pct = wave(CPU, phase, t);
    let mut r = Reading {
        cpu: Some(CpuReading {
            usage_pct: Some(cpu_pct),
            ..CpuReading::default()
        }),
        cpu_temp_c: Some(wave(TEMP, phase, t)),
        memory: Some(MemoryReading {
            total_bytes: bytes(ram_total),
            available_bytes: bytes(ram_total * (1.0 - ram_pct / 100.0)),
            used_pct: ram_pct,
        }),
        disk_used_pct: Some(62.0),
        disks: vec![DiskReading {
            device: if is_pc(m) { "C:" } else { "/dev/sda1" }.to_owned(),
            mount: if is_pc(m) { "C:" } else { "/" }.to_owned(),
            total_bytes: bytes(500.0),
            used_bytes: bytes(310.0),
        }],
        net: Some(NetReading {
            ip: Some(if is_pc(m) { "192.0.2.20" } else { "192.0.2.10" }.to_owned()),
            link_speed_mbps: Some(1000),
            uptime_s: 3.0 * DAY_S + 5400.0,
            down_bytes_per_s: Some(wave(DOWN, phase, t)),
            up_bytes_per_s: Some(wave(UP, phase, t)),
            ..NetReading::default()
        }),
        ping_ms: Some(wave(PING, phase, t)),
        top: vec![TopProgram {
            name: "browser".to_owned(),
            cpu_pct: cpu_pct / 2.0,
            ram_bytes: 1800 * MIB,
            processes: 6,
        }],
        hardware: HardwareInfo {
            cpu: Some("Example CPU 8-core".to_owned()),
            os: Some(if is_pc(m) { "Windows 11" } else { "Linux" }.to_owned()),
            board: is_pc(m).then(|| "Example Board".to_owned()),
            gpu: is_pc(m).then(|| "Example GPU 12 GB".to_owned()),
        },
        ..Reading::default()
    };
    if is_pc(m) {
        r.gpu = Some(GpuReading {
            util_pct: wave(GPU, phase, t),
            temp_c: wave(GTEMP, phase, t),
            vram_used_bytes: bytes(12.0 * wave(VRAM, phase, t) / 100.0),
            vram_total_bytes: bytes(12.0),
            vram_used_pct: wave(VRAM, phase, t),
        });
    }
    if m.runner == Some(true) {
        r.runners = RUNNERS
            .iter()
            .map(|n| RunnerState {
                name: (*n).to_owned(),
                busy: false,
            })
            .collect();
    }
    r
}

/// The series of one machine, `None` for a metric it lacks.
fn series(m: &MachineConfig, wave_of: Wave, now: f64, range: f64) -> Series {
    let step = MIN_STEP_S.max((range / SERIES_POINTS).floor());
    let phase = phase_of(&m.name);
    let mut out = Vec::new();
    let mut t = now - range;
    while t <= now {
        out.push((t.round(), wave(wave_of, phase, t)));
        t += step;
    }
    out
}

fn history(m: &MachineConfig, now: f64, range: f64) -> History {
    let s = |w| series(m, w, now, range);
    let gpu = |w| if is_pc(m) { s(w) } else { Vec::new() };
    let flat = |v: f64| s((v, 0.0, 1.0));
    History {
        cpu: s(CPU),
        ram: s(RAM),
        disk: flat(62.0),
        temp: s(TEMP),
        gpu: gpu(GPU),
        vram: gpu(VRAM),
        gtemp: gpu(GTEMP),
        down: s(DOWN),
        up: s(UP),
        ping: s(PING),
        loss: Some(0.0),
    }
}

/// Finished demo jobs of a runner machine: three of every four two-hour slots hold one.
fn jobs(machines: &[MachineConfig], since: i64, now: i64) -> Vec<FinishedJob> {
    let mut out = Vec::new();
    for m in machines.iter().filter(|m| m.runner == Some(true)) {
        let mut slot = since.max(now - 30 * 86_400) / JOB_SLOT_S;
        while slot * JOB_SLOT_S <= now {
            let (start, n) = (slot * JOB_SLOT_S, slot % 4);
            let end = start + JOB_LENGTH_S + n * 60;
            if n != 3 && end <= now && end >= since {
                let runner = RUNNERS[usize::from(n == 1)];
                out.push(FinishedJob {
                    machine: m.name.clone(),
                    runner: runner.to_owned(),
                    start,
                    end,
                    result: if n == 2 { "Failed" } else { "Succeeded" }.to_owned(),
                    label: format!(
                        "PR #{} · branch-{slot} · Build (example-repo)",
                        100 + slot % 900
                    ),
                });
            }
            slot += 1;
        }
    }
    out.sort_by_key(|j| j.end);
    out
}

/// A backend that answers every command with demo data and keeps the machine list in memory.
pub struct DemoBackend {
    machines: Mutex<Vec<MachineConfig>>,
}

impl Default for DemoBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl DemoBackend {
    /// The two demo machines: `This PC` and `example-server`.
    #[must_use]
    pub fn new() -> Self {
        let pc = MachineConfig {
            name: "This PC".to_owned(),
            kind: MachineKind::Local,
            host: None,
            runner: None,
            was: None,
        };
        let server = MachineConfig {
            name: "example-server".to_owned(),
            kind: MachineKind::Ssh,
            host: Some("192.0.2.10".to_owned()),
            runner: Some(true),
            was: None,
        };
        Self {
            machines: Mutex::new(vec![pc, server]),
        }
    }

    fn list(&self) -> Result<Vec<MachineConfig>, String> {
        self.machines
            .lock()
            .map(|g| g.clone())
            .map_err(|_| "the machine list is locked".to_owned())
    }

    fn named(&self, name: &str) -> Result<Option<MachineConfig>, String> {
        Ok(self.list()?.into_iter().find(|m| m.name == name))
    }
}

fn now_s() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |d| d.as_secs_f64())
}

// reason: unix seconds fit an i64 for the next 292 billion years
#[allow(clippy::cast_possible_truncation)]
fn whole(t: f64) -> i64 {
    t.floor() as i64
}

impl Backend for DemoBackend {
    fn get_state(&self) -> Result<State, String> {
        let now = now_s();
        let machines = self.list()?.into_iter().map(|m| {
            let rules = Rules {
                offline_after_misses: OFFLINE_AFTER,
                has_runners: m.runner == Some(true),
            };
            let mut tracker = Tracker::new(&m.name, rules);
            tracker.observe(reading(&m, now), whole(now));
            tracker.snapshot()
        });
        Ok(State {
            machines: machines.collect(),
        })
    }

    fn get_history(&self, machine: &str, range_s: f64) -> Result<HistoryReply, String> {
        Ok(match self.named(machine)? {
            Some(m) => HistoryReply::Known(Box::new(history(&m, now_s(), range_s))),
            None => HistoryReply::Unknown {},
        })
    }

    fn get_events(&self, since: f64, n: usize) -> Result<Vec<Event>, String> {
        let now = whole(now_s());
        let mut events: Vec<Event> = jobs(&self.list()?, whole(since), now)
            .into_iter()
            .map(|j| Event {
                t: j.end,
                machine: j.machine,
                text: format!("{} finished ({}): {}", j.runner, j.result, j.label),
            })
            .collect();
        events.reverse();
        events.truncate(n);
        Ok(events)
    }

    fn get_jobs(&self, since: f64) -> Result<Vec<FinishedJob>, String> {
        Ok(jobs(&self.list()?, whole(since), whole(now_s())))
    }

    fn get_forecast(&self, machine: &str) -> Result<Forecast, String> {
        let known_server = self.named(machine)?.is_some_and(|m| !is_pc(&m));
        Ok(Forecast {
            per_day: known_server.then_some(FORECAST_PER_DAY),
            days: known_server.then_some(FORECAST_DAYS),
        })
    }

    fn get_machines(&self) -> Result<MachineList, String> {
        Ok(MachineList {
            machines: self.list()?,
        })
    }

    fn save_machines(&self, machines: Vec<MachineConfig>) -> Result<SaveOutcome, String> {
        if let Err(error) = MachineConfig::check_list(&machines) {
            return Ok(SaveOutcome { error: Some(error) });
        }
        let kept = machines
            .into_iter()
            .map(|m| MachineConfig { was: None, ..m });
        let mut guard = self
            .machines
            .lock()
            .map_err(|_| "the machine list is locked".to_owned())?;
        *guard = kept.collect();
        Ok(SaveOutcome { error: None })
    }

    fn restart_collector(&self) -> Result<(), String> {
        Ok(())
    }

    fn stop_everything(&self) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_has_both_machines_in_the_window_shape() {
        let state = serde_json::to_value(DemoBackend::new().get_state().unwrap()).unwrap();
        let machines = state["machines"].as_array().unwrap();
        assert_eq!(machines[0]["name"], "This PC");
        assert_eq!(machines[1]["name"], "example-server");
        assert!(machines[0]["d"]["gpu"].is_number());
        assert!(machines[1]["d"]["gpu"].is_null());
        assert_eq!(machines[1]["d"]["runners"]["runner-1"], false);
        assert!(machines[0]["err"].is_null());
    }

    #[test]
    fn history_is_capped_and_unknown_machines_get_an_empty_object() {
        let demo = DemoBackend::new();
        let known = serde_json::to_value(demo.get_history("This PC", 3600.0).unwrap()).unwrap();
        assert!(known["cpu"].as_array().unwrap().len() <= 402);
        assert!(known["gpu"].as_array().unwrap().len() > 1);
        let none = serde_json::to_value(demo.get_history("nope", 3600.0).unwrap()).unwrap();
        assert_eq!(none, serde_json::json!({}));
        let server =
            serde_json::to_value(demo.get_history("example-server", 3600.0).unwrap()).unwrap();
        assert_eq!(server["gpu"], serde_json::json!([]));
    }

    #[test]
    fn jobs_events_and_forecast_have_the_documented_shapes() {
        let demo = DemoBackend::new();
        let jobs = serde_json::to_value(demo.get_jobs(0.0).unwrap()).unwrap();
        assert_eq!(jobs[0].as_array().unwrap().len(), 6);
        let events = demo.get_events(0.0, 5).unwrap();
        assert_eq!(events.len(), 5);
        assert!(events[0].t >= events[1].t);
        assert_eq!(
            demo.get_forecast("example-server").unwrap().days,
            Some(FORECAST_DAYS)
        );
        assert_eq!(demo.get_forecast("This PC").unwrap().per_day, None);
    }

    #[test]
    fn saving_checks_the_list_and_replaces_it() {
        let demo = DemoBackend::new();
        let mut list = demo.get_machines().unwrap().machines;
        assert_eq!(
            demo.save_machines(Vec::new()).unwrap().error.as_deref(),
            Some("Add at least one machine.")
        );
        list.truncate(1);
        assert_eq!(demo.save_machines(list).unwrap().error, None);
        assert_eq!(demo.get_machines().unwrap().machines.len(), 1);
    }
}
