// Pure helpers for the Processes tab: the sortable, filterable list, the hold-to-confirm timer and the "what was busy" ranking.

export const TOP_ROWS = 50;
// How long "End task" must be held down, in milliseconds.
export const HOLD_MS = 800;
// The ranges "What was busy" can show: [label, seconds].
export const RANGES = [["Last hour", 3600], ["Last 6 hours", 21600], ["Last 24 hours", 86400]];
// The columns the list sorts by: key, column title, and whether the first click sorts high-to-low.
export const SORTS = [["name", "Program", false], ["pid", "ID", false], ["user", "User", false], ["cpu", "CPU", true], ["ram", "Memory", true]];

export const memText = mb => (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB");
export const cpuText = c => c.toFixed(c < 10 ? 1 : 0) + "%";
const nice = name => name.replace(/_/g, " ");

// How far a press has got, 0 to 1, after `elapsed` ms of holding.
export const holdProgress = (elapsed, ms = HOLD_MS) => Math.max(0, Math.min(1, elapsed / ms));

// A reading's d.procs ([pid, name, cpu %, MB, user]) as rows, filtered by a text (name, user or id), sorted, and cut to `limit`.
export function procRows(procs, { key = "cpu", desc = true, filter = "", limit = TOP_ROWS } = {}) {
  const f = filter.trim().toLowerCase();
  const rows = (procs || []).slice(0, TOP_ROWS).map(([pid, name, cpu, mb, user]) => ({ pid, name, shown: nice(name), cpu, ram: mb, user: user || "" }))
    .filter(r => !f || r.shown.toLowerCase().includes(f) || r.user.toLowerCase().includes(f) || String(r.pid).includes(f));
  const sign = desc ? -1 : 1;
  rows.sort((a, b) => sign * (typeof a[key] === "number" ? a[key] - b[key] : a[key].localeCompare(b[key])) || a.pid - b.pid);
  return rows.slice(0, limit);
}
// The sort after a click on column `key`: the same column flips its direction, a new one starts at its natural direction.
export const nextSort = (cur, key) => (cur.key === key ? { key, desc: !cur.desc } : { key, desc: SORTS.find(s => s[0] === key)?.[2] ?? false });

// A get_busiest answer ({ minutes, top: [name, avg cpu %, MB, minutes seen][] }) ranked by CPU or memory:
// [{ name, cpu, mb, minutes, share }] where share is 0 to 100 of the biggest value shown. Empty when nothing was kept.
export function rankRows(answer, by = "cpu", limit = 10) {
  const i = by === "ram" ? 2 : 1, list = [...(answer?.top || [])].sort((a, b) => b[i] - a[i] || a[0].localeCompare(b[0])).slice(0, limit);
  const top = Math.max(Number.EPSILON, ...list.map(r => r[i]));
  return list.map(r => ({ name: nice(r[0]), cpu: r[1], mb: r[2], minutes: r[3], share: Math.round(100 * r[i] / top) }));
}
