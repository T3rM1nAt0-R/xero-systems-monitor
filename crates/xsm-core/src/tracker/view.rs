//! A `Reading` in the shape the window expects (short keys, GiB and MiB, absent when not measured).

use crate::parse::{to_f64, BYTES_PER_MIB};
use crate::reading::Reading;
use serde::{Serialize, Serializer};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// Bytes in a gibibyte.
const BYTES_PER_GIB: f64 = 1_073_741_824.0;

fn put<T: Serialize>(m: &mut Map<String, Value>, key: &str, v: Option<T>) {
    if let Some(v) = v.and_then(|v| serde_json::to_value(v).ok()) {
        m.insert(key.to_owned(), v);
    }
}

/// Like `put`, but an empty list or object counts as "not measured".
fn put_some<T: Serialize>(m: &mut Map<String, Value>, key: &str, v: T) {
    let empty = match serde_json::to_value(&v) {
        Ok(Value::Array(a)) => a.is_empty(),
        Ok(Value::Object(o)) => o.is_empty(),
        _ => false,
    };
    put(m, key, (!empty).then_some(v));
}

fn gib(n: u64) -> f64 {
    to_f64(n) / BYTES_PER_GIB
}

fn mib(n: u64) -> f64 {
    to_f64(n) / to_f64(BYTES_PER_MIB)
}

/// Serialize a reading as the window's `Reading`.
pub(super) fn reading<S: Serializer>(r: &Reading, s: S) -> Result<S::Ok, S::Error> {
    let mut m = Map::new();
    let (net, gpu, mem) = (r.net.as_ref(), r.gpu.as_ref(), r.memory.as_ref());
    put(&mut m, "cpu", r.cpu.as_ref().and_then(|c| c.usage_pct));
    put(&mut m, "temp", r.cpu_temp_c);
    put(&mut m, "ram", mem.map(|x| x.used_pct));
    put(&mut m, "disk", r.disk_used_pct);
    put(&mut m, "gpu", gpu.map(|g| g.util_pct));
    put(&mut m, "gtemp", gpu.map(|g| g.temp_c));
    put(&mut m, "vram", gpu.map(|g| g.vram_used_pct));
    put(&mut m, "down", net.and_then(|n| n.down_bytes_per_s));
    put(&mut m, "up", net.and_then(|n| n.up_bytes_per_s));
    put(&mut m, "ping", r.ping_ms);
    put(&mut m, "speed", net.and_then(|n| n.link_speed_mbps));
    put(&mut m, "uptime", net.map(|n| n.uptime_s));
    put(&mut m, "ip", net.and_then(|n| n.ip.clone()));
    put(&mut m, "restart", r.updates.restart_needed);
    put(&mut m, "restart_pkgs", r.updates.restart_packages);
    put(&mut m, "updates", r.updates.pending);
    let pair = |used: u64, total: u64| [gib(used), gib(total)];
    put(
        &mut m,
        "ram_gb",
        mem.map(|x| {
            pair(
                x.total_bytes.saturating_sub(x.available_bytes),
                x.total_bytes,
            )
        }),
    );
    put(
        &mut m,
        "vram_gb",
        gpu.map(|g| pair(g.vram_used_bytes, g.vram_total_bytes)),
    );
    let disks: Vec<_> = r
        .disks
        .iter()
        .map(|d| (&d.mount, gib(d.used_bytes), gib(d.total_bytes)))
        .collect();
    put_some(&mut m, "storage", disks);
    if let Some(s) = &r.sensors {
        put(&mut m, "mhz", s.cpu_clock_mhz);
        put(&mut m, "cpu_w", s.cpu_power_w);
        put(&mut m, "gpu_w", s.gpu_power_w);
        put_some(&mut m, "fans", &s.fans_rpm);
        put_some(&mut m, "ctemps", &s.core_temp_c);
    }
    cores_battery_gpu_apps(r, &mut m);
    lists(r, &mut m);
    Value::Object(m).serialize(s)
}

/// Per-core load (from the sensors, else from the load counters), the battery and the programs using the GPU.
fn cores_battery_gpu_apps(r: &Reading, m: &mut Map<String, Value>) {
    let usage = r.cpu.as_ref().map(|c| &c.core_usage_pct);
    let loads = r.sensors.as_ref().map(|s| &s.core_load_pct);
    let cores = loads.filter(|l| !l.is_empty()).or(usage);
    put_some(m, "cores", cores.map_or(&[][..], |c| &c[..]));
    let bat = r.battery.as_ref();
    put(
        m,
        "bat",
        bat.map(|b| (b.charge_pct, b.plugged_in, b.minutes_left)),
    );
    let apps = r.gpu_apps.as_ref().map(|a| {
        a.iter()
            .map(|g| (&g.name, mib(g.vram_bytes), g.processes))
            .collect::<Vec<_>>()
    });
    put(m, "gpuapps", apps);
}

/// The list-shaped fields: hardware, programs, runners, jobs, containers, failed units.
fn lists(r: &Reading, m: &mut Map<String, Value>) {
    let mut hw = Map::new();
    let h = &r.hardware;
    for (k, v) in [
        ("board", &h.board),
        ("os", &h.os),
        ("cpu", &h.cpu),
        ("gpu", &h.gpu),
    ] {
        put(&mut hw, k, v.as_ref());
    }
    put_some(m, "hw", hw);
    let top: Vec<_> = r
        .top
        .iter()
        .map(|t| (&t.name, t.cpu_pct, mib(t.ram_bytes), t.processes))
        .collect();
    put_some(m, "top", top);
    let conns: Vec<_> = r.connections.iter().map(|c| (&c.name, c.count)).collect();
    put_some(m, "conns", conns);
    let procs: Vec<_> = r
        .processes
        .iter()
        .map(|p| (p.pid, &p.name, p.cpu_pct, mib(p.ram_bytes), &p.user))
        .collect();
    put_some(m, "procs", procs);
    let runners: BTreeMap<_, _> = r.runners.iter().map(|x| (&x.name, x.busy)).collect();
    put_some(m, "runners", runners);
    let running = || r.jobs.iter().filter(|j| j.is_running());
    let jobs: BTreeMap<_, _> = running()
        .map(|j| (&j.runner, (&j.name, "", &j.git_ref, &j.repo)))
        .collect();
    put_some(m, "jobs", jobs);
    let usage = |j: &crate::reading::JobLine| {
        Some((
            j.cpu_pct?,
            j.ram_bytes.map(mib)?,
            j.vram_bytes.map(mib),
            None::<f64>,
        ))
    };
    let jobres: BTreeMap<_, _> = running()
        .filter_map(|j| Some((&j.runner, usage(j)?)))
        .collect();
    put_some(m, "jobres", jobres);
    let docker = r.containers.as_ref();
    put(
        m,
        "docker",
        docker.map(|l| {
            l.iter()
                .map(|c| {
                    (
                        &c.name,
                        &c.state,
                        &c.status,
                        &c.image,
                        &c.ports,
                        &c.running_for,
                    )
                })
                .collect::<Vec<_>>()
        }),
    );
    put(m, "docker_err", r.docker_error.as_ref());
    put_some(
        m,
        "failed",
        r.failed_services
            .iter()
            .map(|f| &f.unit)
            .collect::<Vec<_>>(),
    );
}
