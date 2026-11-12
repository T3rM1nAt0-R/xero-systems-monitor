// What deserves a desktop pop-up. Pure functions: App.jsx feeds them what the collector said and shows whatever they return.
export const ALERTS = [
  ["offline", "A machine goes offline"],
  ["failed", "A job fails"],
  ["runner", "A runner stops reporting"],
  ["hot", "CPU stays high for 10 minutes"],
  ["svc", "A container or service fails"],
  ["disk", "A disk is nearly full"],
];
export const HOT_MIN = 10;
// Same rule as the collector's container_bad(): restarting, dead, a non-zero exit, or a failing health check. A clean exit is not a failure.
export const containerBad = ([, state, status]) => state === "restarting" || state === "dead" || /\(unhealthy\)/.test(status) || (state === "exited" && /^Exited \((?!0\))\d+\)/.test(status));
const badNow = d => [...(d?.docker || []).filter(containerBad).map(c => "c:" + c[0]), ...(d?.failed || []).map(u => "f:" + u)];
export const DEFAULT_PREFS = { offline: true, failed: true, runner: true, hot: true, svc: true, disk: true };

// Compare the last state with this one. `prev` is what this returned last time (null the first time: nothing alerts).
// Returns { alerts: [{ key, kind, title, body }], next }.
export function machineAlerts(prev, machines, hotSince = {}, now = Date.now()) {
  const next = {}, alerts = [];
  for (const m of machines) {
    const hot = hotSince[m.name]?.cpu || 0, old = prev?.[m.name];
    next[m.name] = { err: !!m.err, gone: m.gone || [], bad: badNow(m.d), hotSent: old?.hotSent && hot > 0 };
    if (!prev) continue;
    if (old && !old.err && m.err) alerts.push({ key: m.name + ":off", kind: "offline", title: `${m.name} is offline`, body: "The monitor can't reach it." });
    for (const r of next[m.name].gone) if (old && !old.gone.includes(r)) alerts.push({ key: `${m.name}:${r}:gone`, kind: "runner", title: `Runner ${r} stopped reporting`, body: `On ${m.name}.` });
    for (const k of next[m.name].bad) if (old && !(old.bad || []).includes(k)) alerts.push({ key: `${m.name}:${k}:${Math.floor(now / 60000)}`, kind: "svc", title: k.startsWith("c:") ? `Container ${k.slice(2)} failed` : `Service ${k.slice(2)} failed`, body: `On ${m.name}.` });
    if (hot > 0 && now - hot >= HOT_MIN * 60000 && !old?.hotSent) { alerts.push({ key: m.name + ":hot", kind: "hot", title: `${m.name} CPU has been high`, body: `Above the limit for ${Math.round((now - hot) / 60000)} min.` }); next[m.name].hotSent = true; }
  }
  return { alerts, next };
}

// Newly finished jobs that failed, from the job rows [machine, runner, start, end, result, label]. `after` = end time already seen (null the first time).
export function failedAlerts(rows, after) {
  let top = after || 0; const alerts = [];
  for (const [machine, runner, , e, res, label] of rows) {
    if (e > top) top = e;
    if (after == null || e <= after || res !== "Failed") continue;   // the first load only sets the mark
    alerts.push({ key: `${machine}:${runner}:${e}`, kind: "failed", title: `Job failed on ${runner}`, body: `${label} (${machine})` });
  }
  return { alerts, after: top };
}

// How many jobs finished in the window, and how many of those failed or were stopped.
export function jobStats(rows, machine, since) {
  let done = 0, failed = 0, stopped = 0;
  for (const [m, , , e, res] of rows) {
    if (m !== machine || e < since) continue;
    done++; if (res === "Failed") failed++; else if (res && res !== "Succeeded") stopped++;
  }
  return { done, failed, stopped };
}

// Disks: any drive above 90 % used, or the forecast says the disk fills within 14 days. One alert per machine per day.
export const DISK_DAYS = 14;
export function diskAlerts(machines, fc, now = Date.now()) {
  const day = Math.floor(now / 86400000), out = [];
  for (const m of machines) {
    if (m.err) continue;
    const full = (m.d?.storage || []).filter(([, u, t]) => t > 0 && u / t > 0.9).sort((x, y) => y[1] / y[2] - x[1] / x[2])[0], days = fc?.[m.name]?.days;
    if (full) out.push({ key: `${m.name}:disk:full:${day}`, kind: "disk", title: `Disk ${full[0]} on ${m.name} is ${Math.round(100 * full[1] / full[2])}% full`, body: "Free some space soon." });
    else if (days != null && days <= DISK_DAYS) out.push({ key: `${m.name}:disk:fc:${day}`, kind: "disk", title: `Disk on ${m.name} fills in about ${days} day${days === 1 ? "" : "s"}`, body: "At the current pace." });
  }
  return out;
}

// Events the collector wrote that deserve a pop-up too (a container that keeps restarting). `after` = newest event time already seen (null the first time).
export function eventAlerts(events, after) {
  let top = after || 0; const alerts = [];
  for (const [t, machine, msg] of events) {
    if (t > top) top = t;
    if (after == null || t <= after || !/keeps restarting/.test(msg)) continue;
    alerts.push({ key: `${machine}:${msg}:${t}`, kind: "svc", title: msg.replace(/ \(.*\)$/, ""), body: `On ${machine}.` });
  }
  return { alerts, after: top };
}
