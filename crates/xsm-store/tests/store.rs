//! Round trips, downsampling bounds, retention, rename, migration and backup.

// reason: test counters are tiny, the casts are exact
#![allow(clippy::cast_precision_loss, clippy::cast_possible_wrap)]

use std::time::{SystemTime, UNIX_EPOCH};
use xsm_core::reading::{CpuReading, GpuReading, MemoryReading, NetReading, Reading};
use xsm_core::tracker::{Event, FinishedJob};
use xsm_store::{Store, MAX_POINTS};

const NOW: i64 = 1_800_000_000;
const DAY: i64 = 86_400;

fn reading(cpu: f64, disk: f64) -> Reading {
    Reading {
        cpu: Some(CpuReading {
            usage_pct: Some(cpu),
            ..CpuReading::default()
        }),
        cpu_temp_c: Some(55.0),
        memory: Some(MemoryReading {
            used_pct: 40.0,
            ..MemoryReading::default()
        }),
        disk_used_pct: Some(disk),
        net: Some(NetReading {
            down_bytes_per_s: Some(100.0),
            up_bytes_per_s: Some(5.0),
            ..NetReading::default()
        }),
        gpu: Some(GpuReading {
            util_pct: 7.0,
            temp_c: 60.0,
            vram_used_pct: 12.0,
            ..GpuReading::default()
        }),
        ping_ms: Some(9.5),
        ..Reading::default()
    }
}

fn job(machine: &str, end: i64) -> FinishedJob {
    FinishedJob {
        machine: machine.into(),
        runner: "r1".into(),
        start: end - 60,
        end,
        result: "Succeeded".into(),
        label: "Build".into(),
    }
}

#[test]
fn sample_round_trip_covers_every_series() {
    let s = Store::open_in_memory().unwrap();
    s.add_sample("example-server", NOW - 10, &reading(50.0, 70.0))
        .unwrap();
    let h = s.history("example-server", 300, NOW).unwrap();
    for series in [
        &h.cpu, &h.ram, &h.disk, &h.temp, &h.gpu, &h.vram, &h.gtemp, &h.down, &h.up, &h.ping,
    ] {
        assert_eq!(series.len(), 1);
    }
    assert!((h.cpu[0].1 - 50.0).abs() < 1e-9);
    assert!((h.ping[0].1 - 9.5).abs() < 1e-9);
    assert!(h.loss.is_none());
}

#[test]
fn missing_facts_and_unknown_machine_give_empty_series() {
    let s = Store::open_in_memory().unwrap();
    s.add_sample(
        "a",
        NOW - 5,
        &Reading {
            ping_ms: Some(1.0),
            ..Reading::default()
        },
    )
    .unwrap();
    let h = s.history("a", 300, NOW).unwrap();
    assert_eq!((h.ping.len(), h.cpu.len(), h.gpu.len()), (1, 0, 0));
    assert_eq!(
        s.history("nope", 300, NOW).unwrap(),
        xsm_store::History::default()
    );
}

#[test]
fn history_is_bounded_for_every_range_and_oldest_first() {
    let s = Store::open_in_memory().unwrap();
    for i in 0..2000 {
        s.add_sample("a", NOW - 2000 + i, &reading(i as f64 % 100.0, 50.0))
            .unwrap();
    }
    for range in [
        300,
        3600,
        DAY,
        30 * DAY,
        365 * DAY,
        400 * DAY,
        500 * DAY,
        0,
        -5,
    ] {
        let h = s.history("a", range, NOW).unwrap();
        assert!(
            h.cpu.len() as i64 <= MAX_POINTS,
            "range {range}: {}",
            h.cpu.len()
        );
        assert!(h.cpu.windows(2).all(|w| w[0].0 < w[1].0));
    }
    assert!(s.history("a", 3600, NOW).unwrap().cpu.len() > 100);
}

#[test]
fn history_spans_raw_minute_and_five_minute_rows() {
    let s = Store::open_in_memory().unwrap();
    for day in 0..10 {
        for k in 0..20 {
            s.add_sample(
                "a",
                NOW - day * DAY - k * 30,
                &reading(10.0 + day as f64, 50.0),
            )
            .unwrap();
        }
    }
    let before = s.history("a", 12 * DAY, NOW).unwrap();
    s.prune(NOW, 365).unwrap();
    let after = s.history("a", 12 * DAY, NOW).unwrap();
    assert!(!after.cpu.is_empty() && after.cpu.len() as i64 <= MAX_POINTS);
    let total =
        |h: &xsm_store::History| h.cpu.iter().map(|p| p.1).sum::<f64>() / h.cpu.len() as f64;
    assert!((total(&before) - total(&after)).abs() < 1.5);
}

#[test]
fn prune_rolls_raw_into_minutes_and_drops_the_old() {
    let s = Store::open_in_memory().unwrap();
    let old = NOW - 2 * DAY;
    for k in 0..6 {
        s.add_sample("a", old + k * 10, &reading(10.0 * k as f64, 50.0))
            .unwrap();
    }
    s.add_sample("a", NOW - 5, &reading(99.0, 50.0)).unwrap();
    s.prune(NOW, 365).unwrap();
    let h = s.history("a", 3 * DAY, NOW).unwrap();
    assert!(h.cpu.len() >= 2, "old minute and fresh raw both survive");
    assert!((h.cpu.last().unwrap().1 - 99.0).abs() < 1e-9);
    s.prune(NOW, 365).unwrap(); // idempotent
    assert_eq!(s.history("a", 3 * DAY, NOW).unwrap().cpu.len(), h.cpu.len());
    // past the retention, everything goes
    s.add_event(&Event {
        t: NOW - 400 * DAY,
        machine: "a".into(),
        text: "old".into(),
    })
    .unwrap();
    s.add_job(&job("a", NOW - 400 * DAY)).unwrap();
    s.prune(NOW + 800 * DAY, 365).unwrap();
    assert!(s
        .history("a", 400 * DAY, NOW + 800 * DAY)
        .unwrap()
        .cpu
        .is_empty());
    assert!(s.events(0, 10).unwrap().is_empty());
    assert!(s.jobs(0).unwrap().is_empty());
}

#[test]
fn events_newest_first_limited_and_since() {
    let s = Store::open_in_memory().unwrap();
    for (t, m) in [(100, "x"), (200, "y"), (200, "z")] {
        s.add_event(&Event {
            t,
            machine: "a".into(),
            text: m.into(),
        })
        .unwrap();
    }
    let texts = |v: Vec<Event>| v.into_iter().map(|e| e.text).collect::<Vec<_>>();
    assert_eq!(texts(s.events(0, 10).unwrap()), ["z", "y", "x"]);
    assert_eq!(texts(s.events(150, 10).unwrap()), ["z", "y"]);
    assert_eq!(texts(s.events(0, 1).unwrap()), ["z"]);
    assert!(s.events(0, 0).unwrap().is_empty());
}

#[test]
fn jobs_oldest_first_since_end() {
    let s = Store::open_in_memory().unwrap();
    s.add_job(&job("a", 500)).unwrap();
    s.add_job(&job("a", 300)).unwrap();
    s.add_job(&FinishedJob {
        result: String::new(),
        ..job("b", 400)
    })
    .unwrap();
    let ends: Vec<i64> = s.jobs(0).unwrap().iter().map(|j| j.end).collect();
    assert_eq!(ends, [300, 400, 500]);
    assert_eq!(s.jobs(400).unwrap().len(), 2);
    assert_eq!(s.jobs(0).unwrap()[1].result, "");
    assert_eq!(s.jobs(500).unwrap()[0], job("a", 500));
}

#[test]
fn rename_moves_everything_and_never_collides() {
    let s = Store::open_in_memory().unwrap();
    s.add_sample("old", NOW - 20, &reading(10.0, 50.0)).unwrap();
    s.add_sample("old", NOW - 4 * DAY, &reading(10.0, 50.0))
        .unwrap();
    s.add_sample("new", NOW - 20, &reading(90.0, 50.0)).unwrap(); // same instant under the new name
    s.add_event(&Event {
        t: NOW,
        machine: "old".into(),
        text: "e".into(),
    })
    .unwrap();
    s.add_job(&job("old", NOW)).unwrap();
    s.prune(NOW, 365).unwrap();
    s.rename_machine("old", "new").unwrap();
    assert!(s.history("old", 5 * DAY, NOW).unwrap().cpu.is_empty());
    let h = s.history("new", 5 * DAY, NOW).unwrap();
    assert_eq!(h.cpu.len(), 2);
    assert!((h.cpu.last().unwrap().1 - 90.0).abs() < 1e-9);
    assert_eq!(s.events(0, 5).unwrap()[0].machine, "new");
    assert_eq!(s.jobs(0).unwrap()[0].machine, "new");
    s.rename_machine("new", "new").unwrap();
    s.rename_machine("", "x").unwrap();
}

#[test]
fn disk_points_are_one_average_per_day() {
    let s = Store::open_in_memory().unwrap();
    let day0 = NOW / DAY * DAY;
    for d in 0..5 {
        s.add_sample("a", day0 - d * DAY + 100, &reading(1.0, 40.0))
            .unwrap();
        s.add_sample("a", day0 - d * DAY + 200, &reading(1.0, 50.0))
            .unwrap();
    }
    s.add_sample("a", day0 - 60 * DAY, &reading(1.0, 10.0))
        .unwrap();
    let pts = s.disk_points("a", 30, NOW).unwrap();
    assert_eq!(pts.len(), 5);
    assert!(pts.windows(2).all(|w| w[0].0 < w[1].0));
    assert!(pts
        .iter()
        .all(|p| (p.1 - 45.0).abs() < 1e-9 && p.0 % DAY == 0));
    assert!(s.disk_points("other", 30, NOW).unwrap().is_empty());
}

fn temp_db(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("xsm-store-{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap_or_else(|e| panic!("{e}"));
    dir.join("history.db")
}

#[test]
fn migrates_from_empty_and_reopens() {
    let path = temp_db("migrate");
    let s = Store::open(&path).unwrap();
    assert_eq!(s.schema_version().unwrap(), 1);
    s.add_event(&Event {
        t: 1,
        machine: "a".into(),
        text: "kept".into(),
    })
    .unwrap();
    drop(s);
    let s = Store::open(&path).unwrap();
    assert_eq!(s.schema_version().unwrap(), 1);
    assert_eq!(s.events(0, 5).unwrap().len(), 1);
    assert_eq!(
        Store::open_in_memory().unwrap().schema_version().unwrap(),
        1
    );
}

#[test]
fn refuses_a_database_from_a_newer_program() {
    let path = temp_db("newer");
    drop(Store::open(&path).unwrap());
    let c = rusqlite::Connection::open(&path).unwrap(); // dev-dependency, to fake a newer file
    c.execute("UPDATE schema_version SET version = 99", [])
        .unwrap();
    drop(c);
    assert!(Store::open(&path).is_err());
}

#[test]
fn backup_is_made_once_a_day_and_is_a_usable_copy() {
    let path = temp_db("backup");
    let s = Store::open(&path).unwrap();
    s.add_event(&Event {
        t: 1,
        machine: "a".into(),
        text: "hello".into(),
    })
    .unwrap();
    let now = i64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    )
    .unwrap();
    assert!(s.backup_daily(&path, now).unwrap());
    assert!(!s.backup_daily(&path, now + 60).unwrap());
    assert!(s.backup_daily(&path, now + 2 * DAY).unwrap());
    let bak = std::path::PathBuf::from(format!("{}.bak", path.display()));
    let copy = Store::open(&bak).unwrap();
    assert_eq!(copy.events(0, 5).unwrap()[0].text, "hello");
}
