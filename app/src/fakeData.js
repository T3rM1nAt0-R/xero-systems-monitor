// Generated demo readings for the plain-browser build (`npm run dev` outside Tauri). Nothing here is real: two made-up machines, drawn from smooth waves plus a little repeatable noise.
// The shapes match docs/window-api.md exactly; fakeBackend.js hands them out.
const TAU = 2 * Math.PI, DAY = 86400, KEYS = ["cpu", "ram", "disk", "temp", "gpu", "vram", "gtemp", "down", "up", "ping"];
const SLOT = 7200, MAX_BACK = 60 * DAY;   // one chance of a job per runner every 2 hours; nothing older than 60 days
const HW = { pc: { board: "Example Board", os: "Windows 11", cpu: "Example CPU 8-core", gpu: "Example GPU 12 GB" }, server: { board: "", os: "Linux", cpu: "Example CPU 16-core" } };
// [base, swing, period in seconds] for each series; the numbers only have to look alive.
const SHAPE = { cpu: [18, 40, 900], ram: [48, 12, 5400], temp: [46, 18, 900], gpu: [8, 45, 1300], gtemp: [40, 22, 1300], vram: [25, 20, 3000], down: [2e5, 3e6, 700], up: [5e4, 6e5, 500], ping: [12, 8, 300] };
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
  return Math.max(0, PERCENT.includes(key) ? Math.min(100, v) : v);
}
export function history(m, rng, now) {
  const kind = kindOf(m), seed = seedOf(m.name), step = Math.max(3, Math.floor(rng / 400)), out = { loss: +(hash(seed) * 0.8).toFixed(1) };
  for (const key of KEYS) {
    out[key] = [];
    for (let t = now - rng; t <= now; t += step) { const v = metric(kind, seed, key, t, now); if (v != null) out[key].push([Math.round(t), +v.toFixed(2)]); }
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

const snap = (m, now) => {
  const kind = kindOf(m), seed = seedOf(m.name), v = k => metric(kind, seed, k, now, now), gpu = kind === "pc";
  const d = { cpu: v("cpu"), temp: v("temp"), ram: v("ram"), disk: v("disk"), down: v("down"), up: v("up"), ping: v("ping"), uptime: 3 * DAY + 5400, restart: gpu, restart_pkgs: gpu ? 2 : undefined, updates: gpu ? 5 : 0, ip: gpu ? "192.0.2.20" : "192.0.2.10", speed: 1000, hw: HW[kind],
    ram_gb: [+((v("ram") / 100) * (gpu ? 32 : 64)).toFixed(1), gpu ? 32 : 64], storage: gpu ? [["C:", 410, 930], ["D:", 1200, 1860]] : [["/", 220, 500]],
    top: [["browser", v("cpu") / 2, 1800, 6], ["editor", v("cpu") / 5, 900, 1], ["build_tool", v("cpu") / 8, 600, 2]] };
  if (gpu) Object.assign(d, { mhz: 3900, cpu_w: +(40 + v("cpu") / 2).toFixed(0), gpu_w: 35, fans: [1180, 920], cores: Array.from({ length: 8 }, (_, i) => +((v("cpu") + i * 7) % 100).toFixed(0)), gpu: v("gpu"), gtemp: v("gtemp"), vram_gb: [+((v("vram") / 100) * 12).toFixed(1), 12] });
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
  d.docker = [["web", "running", "Up 3 days", "example/web:1", "80/tcp", ""], ["db", "running", "Up 3 days", "example/db:1", "5432/tcp", ""]]; d.failed = [];
  return out;
}
