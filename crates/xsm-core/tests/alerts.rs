//! Alert detectors.

use xsm_core::alerts::{check, failed_jobs, flapping, AlertKind, AlertLimits};
use xsm_core::forecast::Forecast;
use xsm_core::reading::{
    ContainerState, CpuReading, DiskReading, FailedService, GpuReading, MemoryReading, Reading,
};
use xsm_core::tracker::{Event, FinishedJob, Rules, Snapshot, Tracker};

const GIB: u64 = 1 << 30;
const LIMITS: AlertLimits = AlertLimits {
    cpu_pct: 90.0,
    mem_pct: 90.0,
    disk_pct: 90.0,
    gpu_temp_c: 85.0,
    cpu_temp_c: 90.0,
};

fn snap(r: Reading) -> Snapshot {
    let mut t = Tracker::new(
        "example-server",
        Rules {
            offline_after_misses: 1,
            has_runners: false,
        },
    );
    t.observe(r, 1);
    t.snapshot()
}

fn texts(a: &[xsm_core::alerts::Alert]) -> Vec<&str> {
    a.iter().map(|a| a.text.as_str()).collect()
}

fn disk(mount: &str, used: u64) -> DiskReading {
    DiskReading {
        device: "sda".into(),
        mount: mount.into(),
        total_bytes: 100 * GIB,
        used_bytes: used * GIB,
    }
}

#[test]
fn quiet_machine_has_no_alerts() {
    let r = Reading {
        cpu: Some(CpuReading {
            usage_pct: Some(90.0),
            ..CpuReading::default()
        }), // exactly at the limit is fine
        memory: Some(MemoryReading {
            used_pct: 10.0,
            ..MemoryReading::default()
        }),
        disks: vec![disk("/", 90)],
        ..Reading::default()
    };
    assert!(check(&snap(r), &LIMITS, None).is_empty());
    assert!(check(&snap(Reading::default()), &LIMITS, None).is_empty());
}

#[test]
fn readings_over_their_limits() {
    let r = Reading {
        cpu: Some(CpuReading {
            usage_pct: Some(95.4),
            ..CpuReading::default()
        }),
        memory: Some(MemoryReading {
            used_pct: 91.0,
            ..MemoryReading::default()
        }),
        gpu: Some(GpuReading {
            temp_c: 86.0,
            ..GpuReading::default()
        }),
        cpu_temp_c: Some(99.0),
        ..Reading::default()
    };
    let a = check(&snap(r), &LIMITS, None);
    assert!(a
        .iter()
        .all(|a| a.kind == AlertKind::Limit && a.machine == "example-server"));
    assert_eq!(
        texts(&a),
        [
            "CPU is 95% (limit 90%)",
            "Memory is 91% (limit 90%)",
            "GPU temperature is 86 C (limit 85 C)",
            "CPU temperature is 99 C (limit 90 C)"
        ]
    );
}

#[test]
fn fullest_disk_wins_and_beats_the_forecast() {
    let r = Reading {
        disks: vec![disk("/", 91), disk("/data", 97), DiskReading::default()],
        ..Reading::default()
    };
    let soon = Forecast {
        per_day: Some(1.0),
        days: Some(3.0),
    };
    let a = check(&snap(r), &LIMITS, Some(&soon));
    assert_eq!(
        (a.len(), a[0].kind, a[0].text.as_str()),
        (1, AlertKind::DiskFull, "Disk /data is 97% full")
    );
}

#[test]
fn forecast_warns_within_two_weeks_only() {
    let s = snap(Reading {
        disks: vec![disk("/", 50)],
        ..Reading::default()
    });
    let f = |days| {
        Some(Forecast {
            per_day: Some(1.0),
            days,
        })
    };
    assert_eq!(
        texts(&check(&s, &LIMITS, f(Some(1.0)).as_ref())),
        ["Disk fills in about 1 day at the current pace"]
    );
    assert_eq!(
        texts(&check(&s, &LIMITS, f(Some(14.0)).as_ref())),
        ["Disk fills in about 14 days at the current pace"]
    );
    assert!(check(&s, &LIMITS, f(Some(15.0)).as_ref()).is_empty());
    assert!(check(&s, &LIMITS, f(None).as_ref()).is_empty());
}

fn container(name: &str, state: &str, status: &str) -> ContainerState {
    ContainerState {
        name: name.into(),
        state: state.into(),
        status: status.into(),
        ..ContainerState::default()
    }
}

#[test]
fn failing_containers_and_units() {
    let list = vec![
        container("ok", "running", "Up 1 hour"),
        container("clean", "exited", "Exited (0) 1 hour ago"),
        container("crashed", "exited", "Exited (137) 1 hour ago"),
        container("sick", "running", "Up 1 hour (unhealthy)"),
        container("loop", "restarting", "Restarting (1) 2 seconds ago"),
        container("dead", "dead", ""),
        container("odd", "exited", "Exited (x) 1 hour ago"),
        container("none", "exited", "Exited () now"),
    ];
    let r = Reading {
        containers: Some(list),
        failed_services: vec![FailedService {
            unit: "b.service".into(),
        }],
        ..Reading::default()
    };
    let a = check(&snap(r), &LIMITS, None);
    assert!(a.iter().all(|a| a.kind == AlertKind::FailedService));
    assert_eq!(
        texts(&a),
        [
            "Container crashed is exited",
            "Container sick is running",
            "Container loop is restarting",
            "Container dead is dead",
            "Service b.service failed"
        ]
    );
}

#[test]
fn unreachable_machines_have_no_alerts() {
    let mut t = Tracker::new(
        "example-server",
        Rules {
            offline_after_misses: 1,
            has_runners: false,
        },
    );
    t.observe(
        Reading {
            cpu_temp_c: Some(120.0),
            ..Reading::default()
        },
        1,
    );
    t.miss(2);
    assert!(check(&t.snapshot(), &LIMITS, None).is_empty());
}

fn job(runner: &str, end: i64, result: &str) -> FinishedJob {
    FinishedJob {
        machine: "example-server".into(),
        runner: runner.into(),
        start: end - 60,
        end,
        result: result.into(),
        label: "PR #7".into(),
    }
}

#[test]
fn failed_jobs_after_the_mark() {
    let rows = [
        job("r1", 100, "Failed"),
        job("r1", 200, "Succeeded"),
        job("r2", 300, "Failed"),
        job("r2", 400, ""),
    ];
    let a = failed_jobs(&rows, 100);
    assert_eq!(texts(&a), ["Job failed on r2: PR #7"]);
    assert_eq!(
        (a[0].kind, a[0].machine.as_str()),
        (AlertKind::FailedJob, "example-server")
    );
    assert_eq!(failed_jobs(&rows, 0).len(), 2);
    assert!(failed_jobs(&rows, 300).is_empty());
}

#[test]
fn flapping_events_after_the_mark() {
    let ev = |t, text: &str| Event {
        t,
        machine: "example-server".into(),
        text: text.into(),
    };
    let rows = [
        ev(
            10,
            "container web keeps restarting (4 state changes in 30 min)",
        ),
        ev(20, "container db is exited"),
        ev(30, "container api keeps restarting"),
    ];
    let a = flapping(&rows, 5);
    assert_eq!(
        texts(&a),
        [
            "container web keeps restarting",
            "container api keeps restarting"
        ]
    );
    assert_eq!(a[0].kind, AlertKind::Flapping);
    assert_eq!(flapping(&rows, 10).len(), 1);
    assert!(flapping(&rows, 30).is_empty());
}

#[test]
fn alerts_serialize_with_snake_case_kinds() {
    let a = failed_jobs(&[job("r1", 5, "Failed")], 0);
    let v = serde_json::to_value(&a[0]).unwrap();
    assert_eq!(v["kind"], "failed_job");
}
