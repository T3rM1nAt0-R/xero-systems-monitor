//! The snapshot in the window's `Machine` shape.
#![recursion_limit = "256"]

use serde_json::json;
use xsm_core::reading::{
    BatteryReading, ConnCount, ContainerState, CpuReading, DiskReading, FailedService, GpuApp,
    GpuReading, HardwareInfo, JobLine, MemoryReading, NetReading, ProcessRow, Reading, RunnerState,
    SensorDetail, TopProgram, UpdateInfo,
};
use xsm_core::tracker::{Rules, Tracker};

const GIB: u64 = 1 << 30;

fn tracker(runners: bool) -> Tracker {
    Tracker::new(
        "example-server",
        Rules {
            offline_after_misses: 3,
            has_runners: runners,
        },
    )
}

fn container(name: &str, state: &str, status: &str) -> ContainerState {
    ContainerState {
        name: name.into(),
        state: state.into(),
        status: status.into(),
        image: "img".into(),
        ..ContainerState::default()
    }
}

fn docker(list: Vec<ContainerState>) -> Reading {
    Reading {
        containers: Some(list),
        ..Reading::default()
    }
}

fn running_job(runner: &str) -> JobLine {
    JobLine {
        runner: runner.into(),
        name: "Build".into(),
        repo: "o/example-repo".into(),
        git_ref: "refs/pull/7/merge".into(),
        head_ref: "fix-it".into(),
        ..JobLine::default()
    }
}

fn result_line(runner: &str, result: &str, log: &str) -> JobLine {
    JobLine {
        runner: runner.into(),
        result: Some(result.into()),
        result_log: Some(log.into()),
        ..JobLine::default()
    }
}

#[test]
// reason: one reading with every field set, checked against the whole window shape
#[allow(clippy::too_many_lines)]
fn snapshot_has_the_window_shape() {
    let mut t = tracker(true);
    let r = Reading {
        cpu: Some(CpuReading {
            usage_pct: Some(12.5),
            idle_ticks: 1.0,
            total_ticks: 2.0,
            ..CpuReading::default()
        }),
        cpu_temp_c: Some(55.0),
        memory: Some(MemoryReading {
            total_bytes: 8 * GIB,
            available_bytes: 6 * GIB,
            used_pct: 25.0,
        }),
        disk_used_pct: Some(40.0),
        disks: vec![DiskReading {
            device: "sda".into(),
            mount: "/".into(),
            total_bytes: 100 * GIB,
            used_bytes: 40 * GIB,
        }],
        net: Some(NetReading {
            ip: Some("192.0.2.5".into()),
            link_speed_mbps: Some(1000),
            uptime_s: 99.0,
            down_bytes_per_s: Some(10.0),
            up_bytes_per_s: Some(5.0),
            ..NetReading::default()
        }),
        gpu: Some(GpuReading {
            util_pct: 3.0,
            temp_c: 40.0,
            vram_used_bytes: GIB,
            vram_total_bytes: 4 * GIB,
            vram_used_pct: 25.0,
        }),
        ping_ms: Some(11.0),
        runners: vec![RunnerState {
            name: "r1".into(),
            busy: true,
        }],
        jobs: vec![
            JobLine {
                cpu_pct: Some(40.0),
                ram_bytes: Some(3000 << 20),
                vram_bytes: Some(10 << 20),
                ..running_job("r1")
            },
            result_line("r2", "Failed", "L"),
        ],
        containers: Some(vec![container("web", "running", "Up")]),
        failed_services: vec![FailedService {
            unit: "x.service".into(),
        }],
        top: vec![TopProgram {
            name: "prog".into(),
            cpu_pct: 7.0,
            ram_bytes: 5 << 20,
            processes: 2,
        }],
        connections: vec![ConnCount {
            name: "prog".into(),
            count: 4,
        }],
        hardware: HardwareInfo {
            os: Some("Linux".into()),
            ..HardwareInfo::default()
        },
        docker_error: None,
        sensors: Some(SensorDetail {
            fans_rpm: vec![900.0],
            cpu_clock_mhz: Some(3500.0),
            cpu_power_w: Some(30.0),
            gpu_power_w: None,
            core_load_pct: vec![5.0, 15.0],
            core_temp_c: Vec::new(),
        }),
        processes: vec![ProcessRow {
            pid: 42,
            name: "prog".into(),
            cpu_pct: 7.0,
            ram_bytes: 5 * 1024 * 1024,
            user: "user".into(),
        }],
        battery: None,
        gpu_apps: None,
        updates: UpdateInfo {
            restart_needed: Some(true),
            restart_packages: Some(2),
            pending: Some(7),
        },
    };
    t.observe(r, 1000);
    let v = serde_json::to_value(t.snapshot()).unwrap();
    let want = json!({
        "name": "example-server", "err": null, "t": 1000, "started": {"r1": 1000}, "gone": [], "cgone": [],
        "d": {
            "cpu": 12.5, "temp": 55.0, "ram": 25.0, "disk": 40.0, "gpu": 3.0, "gtemp": 40.0, "vram": 25.0,
            "down": 10.0, "up": 5.0, "ping": 11.0, "speed": 1000, "uptime": 99.0, "ip": "192.0.2.5",
            "mhz": 3500.0, "cpu_w": 30.0, "fans": [900.0], "cores": [5.0, 15.0],
            "restart": true, "restart_pkgs": 2, "updates": 7,
            "ram_gb": [2.0, 8.0], "vram_gb": [1.0, 4.0], "storage": [["/", 40.0, 100.0]],
            "hw": {"os": "Linux"}, "top": [["prog", 7.0, 5.0, 2]], "conns": [["prog", 4]], "procs": [[42, "prog", 7.0, 5.0, "user"]],
            "runners": {"r1": true},
            "jobs": {"r1": ["Build", "", "refs/pull/7/merge", "o/example-repo"]},
            "jobres": {"r1": [40.0, 3000.0, 10.0, null]},
            "docker": [["web", "running", "Up", "img", "", ""]],
            "failed": ["x.service"]
        }
    });
    assert_eq!(v, want);
}

#[test]
fn empty_machine_snapshot_and_docker_error() {
    let t = tracker(false);
    let v = serde_json::to_value(t.snapshot()).unwrap();
    assert_eq!(
        v,
        json!({"name": "example-server", "err": "starting", "t": null, "d": {}, "started": {}, "gone": [], "cgone": []})
    );
    let mut t = tracker(false);
    t.observe(
        Reading {
            docker_error: Some("denied".into()),
            ..Reading::default()
        },
        1,
    );
    assert_eq!(
        serde_json::to_value(t.snapshot()).unwrap()["d"],
        json!({"docker_err": "denied"})
    );
    let mut t = tracker(false);
    t.observe(docker(vec![]), 1);
    assert_eq!(
        serde_json::to_value(t.snapshot()).unwrap()["d"],
        json!({"docker": []})
    );
}

#[test]
fn battery_core_temperatures_and_gpu_programs_have_the_window_shape() {
    let mut t = tracker(false);
    let r = Reading {
        sensors: Some(SensorDetail {
            core_temp_c: vec![50.0, 52.0],
            ..SensorDetail::default()
        }),
        battery: Some(BatteryReading {
            charge_pct: 80.0,
            plugged_in: false,
            minutes_left: Some(95),
        }),
        gpu_apps: Some(vec![GpuApp {
            name: "game".into(),
            vram_bytes: 2 * 1024 * 1024,
            processes: 1,
        }]),
        ..Reading::default()
    };
    t.observe(r, 1);
    let d = serde_json::to_value(t.snapshot()).unwrap()["d"].clone();
    assert_eq!(
        d,
        json!({"ctemps": [50.0, 52.0], "bat": [80.0, false, 95], "gpuapps": [["game", 2.0, 1]]})
    );
    let mut t = tracker(false);
    t.observe(
        Reading {
            gpu_apps: Some(vec![]),
            ..Reading::default()
        },
        1,
    );
    let d = serde_json::to_value(t.snapshot()).unwrap()["d"].clone();
    assert_eq!(
        d,
        json!({"gpuapps": []}),
        "asked and none is not the same as not asked"
    );
}
