//! Parser tests: every case reads a fixture from `tests/fixtures/probe/`.

use std::fs;
use std::path::Path;
use xsm_core::parse::parse_frame;
use xsm_core::reading::{ContainerState, Reading};

const MIB: u64 = 1024 * 1024;

fn fixture(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/probe");
    fs::read_to_string(path.join(name)).unwrap_or_else(|e| panic!("{name}: {e}"))
}

fn read(name: &str) -> Reading {
    parse_frame(&fixture(name), None)
}

fn read_after(name: &str, before: &str) -> Reading {
    parse_frame(&fixture(name), Some(&read(before)))
}

fn close(got: Option<f64>, want: f64) {
    let Some(got) = got else {
        panic!("no value, want {want}")
    };
    assert!((got - want).abs() < 1e-9, "got {got}, want {want}");
}

#[test]
fn full_sample() {
    let r = read_after("full.txt", "cpu_before.txt");
    close(r.cpu.unwrap().usage_pct, 50.0); // idle grew 200 of 400 ticks
    close(r.memory.as_ref().map(|m| m.used_pct), 75.0);
    close(r.disk_used_pct, 42.0);
    close(r.cpu_temp_c, 61.0); // coretemp beats acpitz, hottest sensor of it
    let mounts: Vec<_> = r.disks.iter().map(|d| d.mount.as_str()).collect();
    assert_eq!(mounts, ["/"]); // the /snap mount is dropped
    assert_eq!(r.disks[0].total_bytes, 1000 * MIB);
    assert_eq!(r.disks[0].used_bytes, 400 * MIB);
    let gpu = r.gpu.unwrap();
    assert_eq!((gpu.util_pct, gpu.temp_c), (12.0, 40.0));
    close(Some(gpu.vram_used_pct), 50.0);
    assert_eq!(gpu.vram_total_bytes, 8192 * MIB);
    let runners: Vec<_> = r
        .runners
        .iter()
        .map(|x| (x.name.as_str(), x.busy))
        .collect();
    assert_eq!(runners, [("jc-1", true), ("jc-2", false)]);
    assert_eq!(r.jobs[0].name, "Fast check");
    assert_eq!(r.jobs[0].git_ref, "refs/pull/7/merge");
    close(r.ping_ms, 12.5);
    assert_eq!(r.hardware.os.as_deref(), Some("Ubuntu"));
    assert_eq!(r.hardware.cpu.as_deref(), Some("Test CPU (8 threads)"));
    assert_eq!(r.memory.unwrap().total_bytes, 1000 * 1024);
}

#[test]
fn first_frame_has_no_rates() {
    let r = read("full.txt");
    assert_eq!(r.cpu.unwrap().usage_pct, None);
    assert!(read("net_after.txt")
        .net
        .unwrap()
        .down_bytes_per_s
        .is_none());
}

#[test]
fn cpu_is_clamped_and_needs_progress() {
    let first = read("full.txt");
    let wrong_way = parse_frame("cpu 2000 0 0 0 0 0 0 0", Some(&first)); // idle went back
    close(wrong_way.cpu.unwrap().usage_pct, 100.0);
    let all_idle = parse_frame("cpu 0 0 0 5000 0 0 0 0", Some(&first)); // idle grew more than time
    close(all_idle.cpu.unwrap().usage_pct, 0.0);
    let same = parse_frame("cpu 100 0 100 700 100 0 0 0", Some(&first));
    assert_eq!(same.cpu.unwrap().usage_pct, None); // no ticks passed
}

#[test]
fn net_rate_uses_machine_uptime() {
    let r = read_after("net_after.txt", "net_before.txt");
    let net = r.net.unwrap();
    close(net.down_bytes_per_s, 100.0);
    close(net.up_bytes_per_s, 200.0);
    assert_eq!(net.ip.as_deref(), Some("192.0.2.10"));
    assert_eq!(net.link_speed_mbps, Some(1000));
    let back = read_after("net_counter_back.txt", "net_before.txt");
    assert_eq!(back.net.unwrap().down_bytes_per_s, None); // counter went back
    let r = parse_frame("NET eth0 - -1 5 6 10.5", Some(&read("net_before.txt")));
    assert_eq!(r.net.unwrap().down_bytes_per_s, None); // no time passed
}

#[test]
fn net_without_ip_or_speed() {
    let net = read("mixed_ok.txt").net.unwrap();
    assert_eq!((net.ip, net.link_speed_mbps), (None, None));
}

#[test]
fn slow_facts_are_kept_from_the_previous_frame() {
    let r = read_after("net_after.txt", "net_before.txt");
    assert_eq!(r.hardware.cpu.as_deref(), Some("Example CPU (4 threads)"));
    assert_eq!(r.top.len(), 1);
    let fresh = parse_frame("TOP 2.0 5 1 vim", Some(&read("net_before.txt")));
    assert_eq!(fresh.top[0].name, "vim"); // a new list replaces the old
}

#[test]
fn job_result_line() {
    let r = read("job_result.txt");
    assert_eq!(r.jobs.len(), 1);
    assert_eq!(r.jobs[0].result.as_deref(), Some("Failed"));
    assert_eq!(r.jobs[0].result_log.as_deref(), Some("Worker_9.log"));
}

#[test]
fn jobs_merge_by_runner() {
    let r = read("jobs.txt");
    let names: Vec<_> = r.jobs.iter().map(|j| j.runner.as_str()).collect();
    assert_eq!(names, ["jc-1", "jc-2", "jc-4"]);
    let j = &r.jobs[0];
    assert_eq!(
        (j.name.as_str(), j.repo.as_str()),
        ("Fast check", "owner/example-repo")
    );
    assert_eq!(j.head_ref, "feat-x");
    close(j.cpu_pct, 12.5);
    assert_eq!(
        (j.ram_bytes, j.vram_bytes),
        (Some(800 * MIB), Some(2048 * MIB))
    );
    assert_eq!(j.result.as_deref(), Some("Succeeded"));
    let idle = &r.jobs[1];
    assert_eq!((idle.name.as_str(), idle.git_ref.as_str()), ("", ""));
    assert_eq!(idle.vram_bytes, None);
    assert_eq!(r.jobs[2].name, "");
}

#[test]
fn versioned_runner_bin_dir() {
    let r = read("versioned_runner.txt");
    let runners: Vec<_> = r
        .runners
        .iter()
        .map(|x| (x.name.as_str(), x.busy))
        .collect();
    assert_eq!(runners, [("actions-runner-docs", true), ("gdd", false)]);
}

#[test]
fn odd_runner_lines_are_skipped() {
    let r = read("runners_odd.txt");
    assert_eq!(r.runners.len(), 1);
    assert_eq!(
        (r.runners[0].name.as_str(), r.runners[0].busy),
        ("r3", false)
    );
}

#[test]
fn bad_line_only_loses_itself() {
    let r = parse_frame(&fixture("bad_line.txt"), Some(&read("cpu_before.txt")));
    assert!(r.memory.is_none() && r.gpu.is_none());
    close(r.disk_used_pct, 10.0);
    assert!(r.cpu.is_some());
}

#[test]
fn malformed_lines_give_an_empty_reading() {
    assert_eq!(read("malformed.txt"), Reading::default());
    assert_eq!(parse_frame("", None), Reading::default());
}

#[test]
fn windows_line_ends_are_fine() {
    let r = read("crlf.txt");
    close(r.disk_used_pct, 5.0);
    assert!(r.cpu.is_some() && r.memory.is_some());
}

#[test]
fn storage_and_sensors_pick_the_right_rows() {
    let r = read("mixed_ok.txt");
    let mounts: Vec<_> = r.disks.iter().map(|d| d.mount.as_str()).collect();
    assert_eq!(mounts, ["/", "/mnt/data disk"]); // the first row of a device wins
    close(r.cpu_temp_c, 40.0); // acpitz is a known CPU sensor, nvme is not
    assert!(r.gpu.is_none());
    let hot = parse_frame("TEMPS nvme 70000\nTEMPS other 50000", None);
    close(hot.cpu_temp_c, 70.0); // no known sensor: the hottest of all
}

#[test]
fn memory_never_goes_negative() {
    let r = parse_frame("MEM 100 400", None);
    close(r.memory.map(|m| m.used_pct), 0.0);
}

#[test]
fn docker_and_failed_units_parse() {
    let r = read("docker.txt");
    let names: Vec<_> = r
        .containers
        .as_ref()
        .unwrap()
        .iter()
        .map(|c| c.name.as_str())
        .collect();
    assert_eq!(names, ["web", "db", "short"]);
    assert_eq!(r.failed_services.len(), 1);
    assert_eq!(r.failed_services[0].unit, "foo.service");
    let web = &r.containers.as_ref().unwrap()[0];
    assert_eq!(web.ports, "0.0.0.0:80->80/tcp");
    assert_eq!(web.running_for, "2 hours ago");
    assert!(r.docker_error.is_none());
}

#[test]
fn docker_markers() {
    let r = read("docker_error.txt");
    assert_eq!(r.containers, Some(Vec::new())); // installed, no containers
    assert!(r.docker_error.unwrap().contains("permission denied"));
    assert!(read("full.txt").containers.is_none()); // not installed
    let long = format!("DOCKERR {}", "x".repeat(500));
    assert_eq!(parse_frame(&long, None).docker_error.unwrap().len(), 200);
    let late = parse_frame("DOCK a|running|Up|i||\nDOCKON", None); // marker after rows keeps them
    assert_eq!(late.containers.unwrap().len(), 1);
}

fn container(state: &str, status: &str) -> ContainerState {
    ContainerState {
        state: state.to_owned(),
        status: status.to_owned(),
        ..ContainerState::default()
    }
}

#[test]
fn bad_containers() {
    assert!(container("exited", "Exited (1) 3 minutes ago").is_bad());
    assert!(!container("exited", "Exited (0) 1 hour ago").is_bad());
    assert!(!container("exited", "Created").is_bad());
    assert!(container("running", "Up 1 minute (unhealthy)").is_bad());
    assert!(container("restarting", "Restarting (1) 5 seconds ago").is_bad());
    assert!(container("dead", "").is_bad());
    assert!(!container("running", "Up 2 hours").is_bad());
}

#[test]
fn top_programs() {
    let r = read("top.txt");
    assert_eq!(r.top.len(), 3);
    assert_eq!(r.top[0].name, "node");
    close(Some(r.top[0].cpu_pct), 12.5);
    assert_eq!((r.top[0].ram_bytes, r.top[0].processes), (800 * MIB, 3));
    assert_eq!(r.top[2].name, "my_program");
}

#[test]
fn hardware_names() {
    let h = read("hardware.txt").hardware;
    assert_eq!(h.cpu.as_deref(), Some("Example CPU (4 threads)"));
    assert_eq!(h.gpu, None); // an empty name is no name
    assert_eq!(h.os.as_deref(), Some("Example Linux 1.0"));
    assert_eq!(h.board.as_deref(), Some("Example Board"));
}

#[test]
fn reading_survives_json() {
    let r = read("full.txt");
    let text = serde_json::to_string(&r).unwrap();
    assert_eq!(serde_json::from_str::<Reading>(&text).unwrap(), r);
}
