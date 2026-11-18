// Limits you can set per machine. Pure: the window stores the numbers, these functions fill in the defaults and sanity-check them.
import { LIM } from "./format.js";
export const DISK_DAYS = 14;
// [key, label, unit, min, max]. The defaults are the limits the monitor always used.
export const LIMIT_FIELDS = [
  ["cpu", "CPU", "%", 1, 100],
  ["temp", "CPU temp", "°C", 1, 150],
  ["gtemp", "GPU temp", "°C", 1, 150],
  ["disk", "Disk", "%", 1, 100],
  ["days", "Disk full in", "days", 1, 365],
];
export const DEFAULT_LIMITS = { cpu: LIM.cpu, temp: LIM.temp, gtemp: LIM.gtemp, disk: 90, days: DISK_DAYS };

// A typed value, or the default when it is empty, not a number, or out of range.
export function cleanLimit(k, v) {
  const f = LIMIT_FIELDS.find(x => x[0] === k), n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return f && Number.isFinite(n) && n >= f[3] && n <= f[4] ? n : DEFAULT_LIMITS[k];
}
// One machine's limits: what was saved for it, over the defaults. `all` is { machineName: { cpu, ... } }.
export function limitsFor(all, name) {
  const mine = all?.[name] || {}, out = {};
  for (const k of Object.keys(DEFAULT_LIMITS)) out[k] = k in mine ? cleanLimit(k, mine[k]) : DEFAULT_LIMITS[k];
  return out;
}
// Set one limit for one machine, or for every machine in `names` when `name` is null ("Same for all").
// An empty string is kept while typing; it counts as the default.
export function setLimit(all, names, name, k, v) {
  const next = { ...all };
  for (const n of name == null ? names : [name]) next[n] = { ...(all[n] || {}), [k]: v === "" ? "" : Number(v) };
  return next;
}
// The saved form: only values that differ from the defaults, and only valid ones.
export function tidyLimits(all) {
  const out = {};
  for (const [n, mine] of Object.entries(all || {})) {
    const o = {};
    for (const k of Object.keys(DEFAULT_LIMITS)) if (k in mine && cleanLimit(k, mine[k]) !== DEFAULT_LIMITS[k]) o[k] = cleanLimit(k, mine[k]);
    if (Object.keys(o).length) out[n] = o;
  }
  return out;
}
