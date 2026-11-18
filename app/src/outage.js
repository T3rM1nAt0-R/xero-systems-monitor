import { hm } from "./format.js";
// The outage strip: for each slice of the last 24 hours or 7 days, was the machine online, offline or without data? Pure.
// Offline comes from the Activity events "went offline" / "back online" (and from the machine being unreachable right now); no data is a slice with no stored reading.
export const STRIP_SPANS = { day: { secs: 86400, cells: 48, label: "24 h" }, week: { secs: 604800, cells: 84, label: "7 d" } };
export const STRIP_STATUS = { on: "Online", off: "Offline", none: "No data" };
// Offline stretches [start, end] from events [t, machine, text] of one machine. A stretch still open at `now` ends at `now`.
export function offlineSpans(events, machine, now, offNow = false) {
  const list = events.filter(e => e[1] === machine).sort((a, b) => a[0] - b[0]), out = [];
  let from = null;
  for (const [t, , text] of list) {
    if (/went offline/.test(text) && from == null) from = t;
    else if (/back online/.test(text) && from != null) { out.push([from, t]); from = null; }
  }
  if (from != null || offNow) out.push([from ?? now, now]);
  return out;
}
// Cells for the strip: [{ a, b, w, status, text }] with status on | off | none, neighbours with the same status merged, w the width in percent.
export function stripCells({ events = [], pts = [], machine, now, span = "day", offNow = false }) {
  const { secs, cells } = STRIP_SPANS[span], step = secs / cells, t0 = now - secs, offs = offlineSpans(events, machine, now, offNow);
  const have = new Set(pts.map(p => Math.floor((p[0] - t0) / step))), out = [];
  for (let i = 0; i < cells; i++) {
    const a = t0 + i * step, b = a + step, status = offs.some(([x, y]) => x < b && y > a) ? "off" : have.has(i) ? "on" : "none", last = out[out.length - 1];
    if (last && last.status === status) { last.b = b; last.n++; } else out.push({ a, b, status, n: 1 });
  }
  return out.map(c => ({ ...c, w: (c.n / cells) * 100, text: `${STRIP_STATUS[c.status]} · ${hm(c.a)} to ${hm(Math.min(c.b, now))}` }));
}
