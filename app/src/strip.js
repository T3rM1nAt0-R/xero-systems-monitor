// Pure helpers for the machines strip at the top of the window.
const pct = v => (v == null ? null : Math.round(v));
// What one tile shows. `hm` formats a time of day (12-hour AM/PM).
export function tileModel(m, lastOk, hm) {
  const d = m.d || {}, off = !!m.err;
  return { name: m.name, off, cpu: pct(d.cpu), mem: pct(d.ram), gpu: pct(d.gpu), temp: pct(d.temp), seen: off ? (lastOk ? `last seen ${hm(lastOk)}` : "not seen yet") : "" };
}
// An SVG polyline "points" string for [[t, value], ...] drawn in a w x h box (value 0..max); fewer than two points give "".
export function sparkPoints(pts, w, h, max = 100) {
  if (!Array.isArray(pts) || pts.length < 2) return "";
  const t0 = pts[0][0], span = pts[pts.length - 1][0] - t0 || 1;
  return pts.map(([t, v]) => `${((t - t0) / span * w).toFixed(1)},${(h - Math.min(max, Math.max(0, v)) / max * h).toFixed(1)}`).join(" ");
}
