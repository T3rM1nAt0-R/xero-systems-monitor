//! The live backend end to end, with a fake ssh that prints fixture frames.

// reason: the helpers outside #[test] functions may panic on a broken test setup
#![allow(clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use xsm_collector::{Backend, HistoryReply, LiveBackend, MachineKind};

const FIXTURE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../tests/fixtures/probe/full.txt"
);
const COLLECTOR: &str =
    r#"{"poll_seconds":1,"history_days":365,"ssh_reconnect_seconds":1,"offline_after_misses":2}"#;
const LIMITS: &str = r#"{"cpu_pct":90,"mem_pct":90,"disk_pct":90,"gpu_temp_c":85,"cpu_temp_c":90}"#;
const MACHINES: &str = r#"[{"name":"fake-box","kind":"ssh","host":"alive"},
    {"name":"dead-box","kind":"ssh","host":"dead"}]"#;

fn temp_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.subsec_nanos());
    let dir = std::env::temp_dir().join(format!("xsm-live-{}-{nanos}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// A fake ssh: host `alive` prints the fixture frame again and again, any other host fails.
fn fake_ssh(host: &str) -> Command {
    let script = if host == "alive" {
        format!("while :; do cat {FIXTURE}; echo @@END; sleep 0.2; done")
    } else {
        "exit 1".to_owned()
    };
    let mut c = Command::new("sh");
    c.arg("-c").arg(script);
    c
}

fn wait_until(what: &str, mut f: impl FnMut() -> bool) {
    let end = Instant::now() + Duration::from_secs(4);
    while Instant::now() < end {
        if f() {
            return;
        }
        sleep(Duration::from_millis(50));
    }
    panic!("timed out waiting for {what}");
}

fn setup() -> (PathBuf, PathBuf) {
    let (data, settings) = (temp_dir(), temp_dir());
    std::fs::write(settings.join("collector.json"), COLLECTOR).unwrap();
    std::fs::write(settings.join("limits.json"), LIMITS).unwrap();
    std::fs::write(data.join("machines.json"), MACHINES).unwrap();
    (data, settings)
}

fn known(reply: &HistoryReply) -> serde_json::Value {
    let v = serde_json::to_value(reply).unwrap();
    assert!(v.as_object().is_some_and(|o| !o.is_empty()), "unknown");
    v
}

#[test]
fn polls_fake_machines_and_serves_every_shape() {
    let (data, settings) = setup();
    let b = LiveBackend::start_with_ssh(&data, Some(&settings), fake_ssh).unwrap();
    let series = |name: &str, key: &str| -> usize {
        let reply = b.get_history(name, 60.0).unwrap();
        known(&reply)[key].as_array().unwrap().len()
    };
    wait_until("two samples", || series("fake-box", "ram") >= 2);
    let events = || b.get_events(0.0, 10).unwrap();
    wait_until("offline event", || {
        events().iter().any(|e| e.text == "went offline")
    });

    let state = serde_json::to_value(b.get_state().unwrap()).unwrap();
    let m = state["machines"].as_array().unwrap();
    assert_eq!(m[0]["name"], "fake-box");
    assert!(m[0]["err"].is_null());
    assert!(m[0]["d"]["ram"].is_number());
    assert_eq!(m[1]["name"], "dead-box");
    assert!(m[1]["err"].is_string());

    let e = serde_json::to_value(events()).unwrap();
    assert_eq!(e[0][1], "dead-box");
    assert!(e[0][0].is_i64());
    let h = known(&b.get_history("fake-box", 60.0).unwrap());
    let first = h["ram"][0].as_array().unwrap();
    assert!(first[0].is_f64() && first[1].is_f64());
    assert!(!h["gpu"].as_array().unwrap().is_empty());
    assert_eq!(
        b.get_history("nobody", 60.0).unwrap(),
        HistoryReply::Unknown {}
    );
    assert!(b.get_jobs(0.0).unwrap().is_empty());
    assert!(b.get_forecast("fake-box").unwrap().days.is_none());
    b.stop_everything().unwrap();
}

#[test]
fn renaming_moves_history_and_saves_the_list_without_was() {
    let (data, settings) = setup();
    let b = LiveBackend::start_with_ssh(&data, Some(&settings), fake_ssh).unwrap();
    wait_until("a sample", || {
        b.get_history("fake-box", 60.0).is_ok_and(|r| {
            serde_json::to_value(r).unwrap()["ram"]
                .as_array()
                .is_some_and(|a| !a.is_empty())
        })
    });
    let mut list = b.get_machines().unwrap().machines;
    list[0].name = "renamed-box".to_owned();
    list[0].was = Some("fake-box".to_owned());
    assert_eq!(b.save_machines(list).unwrap().error, None);
    assert!(!known(&b.get_history("renamed-box", 60.0).unwrap())["ram"]
        .as_array()
        .unwrap()
        .is_empty());
    assert_eq!(
        b.get_history("fake-box", 60.0).unwrap(),
        HistoryReply::Unknown {}
    );
    let saved = std::fs::read_to_string(data.join("machines.json")).unwrap();
    assert!(saved.contains("renamed-box") && !saved.contains("was"));
    let bad = b.save_machines(Vec::new()).unwrap();
    assert!(bad.error.is_some());
    b.restart_collector().unwrap();
    assert_eq!(b.get_state().unwrap().machines.len(), 2);
    b.stop_everything().unwrap();
}

#[test]
fn first_run_lists_just_this_pc() {
    let data = temp_dir();
    let b = LiveBackend::start_with_ssh(&data, None::<&Path>, fake_ssh).unwrap();
    let list = b.get_machines().unwrap().machines;
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].name, "This PC");
    assert_eq!(list[0].kind, MachineKind::Local);
    assert!(data.join("machines.json").exists());
    b.stop_everything().unwrap();
}
