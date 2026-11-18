// Generated demo readings for the plain-browser build (`npm run dev` outside Tauri). Nothing here is real: two made-up machines, drawn from smooth waves plus a little repeatable noise.
// The shapes match docs/window-api.md exactly; fakeBackend.js hands them out.
const TAU = 2 * Math.PI, DAY = 86400, KEYS = ["cpu", "ram", "disk", "temp", "gpu", "vram", "gtemp", "down", "up", "ping"];
const SLOT = 7200, MAX_BACK = 60 * DAY;   // one chance of a job per runner every 2 hours; nothing older than 60 days
const HW = { pc: { board: "Example Board", os: "Windows 11", cpu: "Example CPU 8-core", gpu: "Example GPU 12 GB" }, server: { board: "", os: "Linux", cpu: "Example CPU 16-core" } };
// [base, swing, period in seconds] for each series; the numbers only have to look alive.
const SHAPE = { cpu: [18, 40, 900], ram: [48, 12, 5400], temp: [46, 18, 900], gpu: [8, 45, 1300], gtemp: [40, 22, 1300], vram: [25, 20, 3000], down: [2e5, 3e6, 700], up: [5e4, 6e5, 500], ping: [12, 8, 300] };
const BURST_SECS = 1800, BURST_CPU = 82;
const PERCENT = ["cpu", "ram", "gpu", "vram", "disk"], RUNNERS = ["runner-1", "runner-2"], WORKFLOWS = ["Fast check", "Unit tests", "Build"];

export const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
export const seedOf = name => [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
export const kindOf = m => (m.kind === "local" ? "pc" : "server");

// One value of one series at time t (seconds). `now` anchors the slowly filling disk.
export function metric(kind, seed, key, t, now) {
  if (kind === "server" && ["gpu", "gtemp", "vram"].includes(key)) return null;
  if (key === "disk") return +(62 - ((now - t) / DAY) * 0.4).toFixed(2);
  const [base, swing, period] = SHAPE[key], k = KEYS.indexOf(key);
  const v = base + swing * (0.5 + 0.5 * Math.sin((t / period) * TAU + seed + k)) + (hash(Math.floor(t / 3) + seed + k) - 0.5) * swing * 0.2;
  if (key === "cpu" && kind === "pc" && now - t < BURST_SECS) return BURST_CPU;   // This PC has been working hard for the last half hour, so "Unusual for this time" shows in the demo
  return Math.max(0, PERCENT.includes(key) ? Math.min(100, v) : v);
}
// Made-up happenings per machine, as [seconds before now, length, what]: an outage with events, a stretch with no readings, a container that keeps restarting.
const HAPPENINGS = { pc: [[3 * DAY, 2400, "offline"], [5 * DAY, 7200, "nodata"]], server: [[20 * 3600, 1800, "offline"], [4 * 3600, 0, "container"]] };
const happenings = (m, now) => HAPPENINGS[kindOf(m)].map(([ago, len, what]) => ({ t: now - ago, len, what }));
const inGap = (hs, t) => hs.some(h => (h.what === "offline" || h.what === "nodata") && t >= h.t && t <= h.t + h.len);
export const driveNames = m => (kindOf(m) === "pc" ? ["C:", "D:"] : ["/"]);
export function history(m, rng, now) {
  const kind = kindOf(m), seed = seedOf(m.name), step = Math.max(3, Math.floor(rng / 400)), out = { loss: +(hash(seed) * 0.8).toFixed(1), extra: {} }, gaps = happenings(m, now);
  if (kind === "pc") {   // the internet check (a short outage a few hours ago) and the ping times to the other machines
    out.extra.inet = []; out.extra.inet_ms = []; out.extra["pm:example-server"] = []; out.extra["pm:example-nas"] = [];
    for (let t = now - rng; t <= now; t += Math.max(60, step)) {
      const down = Math.abs(t - (now - 5 * 3600)) < 600;
      out.extra.inet.push([Math.round(t), down ? 0 : 1]);
      if (!down) { out.extra.inet_ms.push([Math.round(t), +(35 + hash(Math.floor(t / 60)) * 20).toFixed(0)]); out.extra["pm:example-server"].push([Math.round(t), +(3 + hash(Math.floor(t / 30)) * 2).toFixed(1)]); out.extra["pm:example-nas"].push([Math.round(t), +(150 + hash(Math.floor(t / 30) + 9) * 120).toFixed(0)]); }
    }
  }
  for (const [i, n] of driveNames(m).entries()) for (const [p, key, f] of [["dr:", "down", 0.4 / (i + 1)], ["dw:", "up", 0.6 / (i + 1)]]) {
    out.extra[p + n] = [];
    for (let t = now - rng; t <= now; t += step) out.extra[p + n].push([Math.round(t), +(metric(kind, seed, key, t, now) * f).toFixed(0)]);
  }
  for (const key of KEYS) {
    out[key] = [];
    for (let t = now - rng; t <= now; t += step) { if (inGap(gaps, t)) continue; const v = metric(kind, seed, key, t, now); if (v != null) out[key].push([Math.round(t), +v.toFixed(2)]); }
  }
  return out;
}

// Jobs: each runner may run one job per time slot; a job that has not ended yet is "running" and shows on the card instead of in the finished rows.
const jobsIn = (name, slot) => RUNNERS.flatMap((runner, i) => {
  const h = hash(slot * 7 + i + seedOf(name));
  if (h < 0.35) return [];
  const t0 = slot * SLOT + Math.floor(h * 3000), n = 100 + Math.floor(h * 900), flow = WORKFLOWS[Math.floor(h * 31) % WORKFLOWS.length];
  const res = h > 0.92 ? "Failed" : h > 0.88 ? "Canceled" : "Succeeded";
  return [{ runner, t0, t1: t0 + 240 + Math.floor(h * 2000), res, n, flow, label: `PR #${n} · branch-${n} · ${flow} (example/example-repo)` }];
});
const allJobs = (name, since, now) => {
  const out = [];
  for (let s = Math.floor(Math.max(since - SLOT, now - MAX_BACK) / SLOT); s <= Math.floor(now / SLOT); s++) out.push(...jobsIn(name, s));
  return out.filter(j => j.t0 <= now).sort((a, b) => a.t1 - b.t1);
};
export const finishedJobs = (machines, since, now) => machines.filter(m => m.runner).flatMap(m =>
  allJobs(m.name, since, now).filter(j => j.t1 <= now && j.t1 >= since).map(j => [m.name, j.runner, j.t0, j.t1, j.res, j.label]));
export const demoEvents = (machines, since, now, n) => {
  const rows = [];
  for (const m of machines.filter(x => x.runner)) for (const j of allJobs(m.name, since, now)) {
    rows.push([j.t0, m.name, `${j.runner} started: PR #${j.n} · ${j.flow}`]);
    if (j.t1 <= now) rows.push([j.t1, m.name, `${j.runner} finished (${Math.round((j.t1 - j.t0) / 60)} min, ${j.res}): PR #${j.n}`]);
  }
  for (const m of machines) for (const h of happenings(m, now)) {
    if (h.what === "offline") rows.push([h.t, m.name, "went offline"], [h.t + h.len, m.name, "back online"]);
    if (h.what === "container") rows.push([h.t, m.name, "container web keeps restarting"]);
  }
  return rows.filter(r => r[0] >= since).sort((a, b) => b[0] - a[0]).slice(0, n);
};
// What was busy around time t (the stored minute nearest to it): a few made-up programs that share the machine's CPU at that moment.
const PROGRAMS = ["browser", "editor", "build_tool", "video_call", "backup", "indexer"];
export function busyAt(m, t) {
  const minute = Math.floor(t / 60) * 60, kind = kindOf(m), seed = seedOf(m.name), cpu = metric(kind, seed, "cpu", minute, minute);
  const share = PROGRAMS.map((name, i) => ({ name, w: hash(Math.floor(minute / 600) * 11 + i + seed) + 0.1 })), sum = share.reduce((a, s) => a + s.w, 0);
  const top = share.map((s, i) => [s.name, +(cpu * 0.9 * s.w / sum).toFixed(1), Math.round(300 + 1500 * hash(i + seed)), 1 + Math.floor(hash(i * 5 + seed) * 5)]);
  return { t: minute, top: top.sort((a, b) => b[1] - a[1]) };
}
export const forecast = m => (kindOf(m) === "server" ? { per_day: 0.4, days: 95 } : { per_day: null, days: null });

// Made-up processes: [pid, name, share of the CPU use, MB]. The server shows who runs each (This PC does not report users).
const PROCS = [["browser", 0.3, 1800], ["browser", 0.1, 650], ["editor", 0.2, 900], ["build_tool", 0.15, 600], ["video_call", 0.12, 700], ["backup", 0.08, 300], ["indexer", 0.05, 250], ["sync_tool", 0.02, 120], ["browser", 0.02, 410], ["shell", 0, 20]];
const procs = (cpu, kind) => PROCS.map(([name, w, mb], i) => [1000 + i * 37, name, +(cpu * w).toFixed(1), mb, kind === "pc" ? "" : i % 3 ? "user" : "root"]);
// What was busy over a range: the same programs, ranked by their average CPU and how many minutes each was among the busiest.
export function busiest(m, range, now) {
  const minutes = Math.max(0, Math.floor(range / 60)), cpu = metric(kindOf(m), seedOf(m.name), "cpu", now, now), seen = new Map();
  for (const [, name, c, mb] of procs(cpu, kindOf(m))) { const e = seen.get(name) || [name, 0, 0, minutes]; e[1] += c; e[2] = Math.max(e[2], mb); seen.set(name, e); }
  return { minutes, top: [...seen.values()].map(([n, c, mb, k], i) => [n, +c.toFixed(1), mb, Math.max(1, Math.round(k * (1 - i * 0.07)))]).sort((a, b) => b[1] - a[1]) };
}
const snap = (m, now) => {
  const kind = kindOf(m), seed = seedOf(m.name), v = k => metric(kind, seed, k, now, now), gpu = kind === "pc";
  const d = { cpu: v("cpu"), temp: v("temp"), ram: v("ram"), disk: v("disk"), down: v("down"), up: v("up"), ping: v("ping"), uptime: 3 * DAY + 5400, restart: gpu, restart_pkgs: gpu ? 2 : undefined, updates: gpu ? 5 : 0, ip: gpu ? "192.0.2.20" : "192.0.2.10", speed: 1000, hw: HW[kind],
    ram_gb: [+((v("ram") / 100) * (gpu ? 32 : 64)).toFixed(1), gpu ? 32 : 64], storage: gpu ? [["C:", 410, 930], ["D:", 1200, 1860]] : [["/", 220, 500]],
    procs: procs(v("cpu"), kind),
    top: [["browser", v("cpu") / 2, 1800, 6], ["editor", v("cpu") / 5, 900, 1], ["build_tool", v("cpu") / 8, 600, 2]] };
  d.io = driveNames(m).map((n, i) => [n, Math.round(v("down") * 0.4 / (i + 1)), Math.round(v("up") * 0.6 / (i + 1))]);   // drive speeds, bytes per second
  if (gpu) Object.assign(d, { adapters: [["Ethernet", true, 1000, "192.0.2.20"], ["Wi-Fi", true, 866, "192.0.2.21"], ["VPN", false, null, null]], wifi: ["Example Wi-Fi", 82], inet: [true, 14, 38 + Math.round(hash(Math.floor(now / 60)) * 20)], pings: [["example-server", 3.4], ["example-nas", 240], ["example-laptop", null]] });
  else d.adapters = [["eth0", true, 1000, "192.0.2.10"]];
  if (gpu) d.smart = [["Example_SSD_1TB", "SSD", true, 38, 9400, 12], ["Example_HDD_2TB", "HDD", false, 41, 31000, null]]; else d.smart_note = "missing";   // drive health: the server shows the "install smartmontools" hint
  if (gpu) Object.assign(d, { mhz: 3900, cpu_w: +(40 + v("cpu") / 2).toFixed(0), gpu_w: 35, fans: [1180, 920], cores: Array.from({ length: 8 }, (_, i) => +((v("cpu") + i * 7) % 100).toFixed(0)), gpu: v("gpu"), gtemp: v("gtemp"), vram_gb: [+((v("vram") / 100) * 12).toFixed(1), 12] });
  if (gpu) Object.assign(d, { ctemps: d.cores.map((c, i) => +(42 + c / 4 + i).toFixed(0)), bat: [Math.round(20 + v("cpu") / 2), false, 130], gpuapps: [["game", 5000, 1], ["browser", 800, 3], ["video_call", 0, 1]] });
  if (!gpu) Object.assign(d, { cores: Array.from({ length: 4 }, (_, i) => +((v("cpu") + i * 9) % 100).toFixed(0)), ctemps: [51, 53, 50, 52], fans: [2100] });
  if (gpu) d.conns = [["browser", 42], ["video_call", 9], ["editor", 6], ["sync_tool", 4], ["build_tool", 2]];   // connections per program: This PC only (Windows)
  return d;
};
export function demoMachine(m, now) {
  const d = snap(m, now), out = { name: m.name, d, err: null, t: now, started: {}, gone: [], cgone: [] };
  if (!m.runner) return out;
  d.runners = {}; d.jobs = {}; d.jobres = {};
  for (const r of RUNNERS) d.runners[r] = false;
  for (const j of allJobs(m.name, now - SLOT, now).filter(x => x.t1 > now)) {
    d.runners[j.runner] = true; d.jobs[j.runner] = [j.flow, "", `refs/pull/${j.n}/merge`, "example/example-repo"]; d.jobres[j.runner] = [40, 3000, null, null]; out.started[j.runner] = j.t0;
  }
  d.queued = [["PR #412 · Build (example/example-repo)", now - 340], ["PR #413 · Unit tests (example/example-repo)", now - 95]];   // jobs waiting for one of these runners
  d.docker = [["web", "running", "Up 3 days", "example/web:1", "80/tcp", ""], ["db", "running", "Up 3 days", "example/db:1", "5432/tcp", ""]]; d.failed = [];
  return out;
}
