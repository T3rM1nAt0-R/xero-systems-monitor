// Pure helpers for the graph tools: compare with an earlier day, drag-to-zoom, and the CSV export. No DOM, no clock.
export const DAY = 86400;
export const COMPARE = [["off", 0], ["yesterday", DAY], ["last week", 7 * DAY]];   // [label, seconds back]
export const MIN_ZOOM = 60;       // the smallest zoom span, seconds
export const CLICK_PX = 4;       // the pointer moved at most this many pixels since it went down: a click
export const MIN_DRAG = 0.02;     // a drag shorter than this share of the graph width is a click, not a zoom

// Points inside [a, b], with the line cut exactly at the edges (a straight line between the neighbours outside).
export function clipSeries(pts, a, b) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const t = pts[i][0];
    if (t >= a && t <= b) {
      if (!out.length && i > 0 && pts[i - 1][0] < a) out.push(edge(pts[i - 1], pts[i], a));
      out.push(pts[i]);
      if (i + 1 < pts.length && pts[i + 1][0] > b) out.push(edge(pts[i], pts[i + 1], b));
    } else if (t < a && i + 1 < pts.length && pts[i + 1][0] > b) { out.push(edge(pts[i], pts[i + 1], a), edge(pts[i], pts[i + 1], b)); }   // one segment spans the whole window
  }
  return out;
}
const edge = ([t1, v1], [t2, v2], t) => [t, v1 + ((v2 - v1) * (t - t1)) / (t2 - t1)];

// An older series moved forward by `offset` seconds so it lines up with the live window, then cut to it.
export const shiftSeries = (pts, offset, a, b) => clipSeries((pts || []).map(([t, v]) => [t + offset, v]), a, b);

// Was this a click? `from` is where the pointer went down ([x, y], or null when unknown), (x, y) is where it came up. A drag across the graph (to zoom) is not a click.
export const isClick = (from, x, y) => !from || Math.hypot(x - from[0], y - from[1]) <= CLICK_PX;

// The span picked by dragging from share qa to share qb (0..1) across a graph showing [t0, t1]. null when it was only a click.
export function zoomRange(t0, t1, qa, qb) {
  const lo = Math.max(0, Math.min(qa, qb)), hi = Math.min(1, Math.max(qa, qb));
  if (hi - lo < MIN_DRAG) return null;
  const a = t0 + lo * (t1 - t0), b = t0 + hi * (t1 - t0);
  return b - a < MIN_ZOOM ? [a, a + MIN_ZOOM] : [a, b];
}

const q = s => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const T12 = { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true };
const stamp = t => { const d = new Date(t * 1000); return d.toLocaleDateString("en-CA") + " " + d.toLocaleTimeString("en-US", T12); };   // "2026-11-18 3:05:07 PM", local time
// Time (local 12-hour) plus one column per series. Rows are the union of every series' times, oldest first; a gap stays empty.
export function toCsv(series) {
  const times = [...new Set(series.flatMap(s => s.pts.map(p => p[0])))].sort((x, y) => x - y);
  const maps = series.map(s => new Map(s.pts.map(([t, v]) => [t, v])));
  const lines = [["Time", ...series.map(s => q(s.name))].join(",")];
  for (const t of times) lines.push([q(stamp(t)), ...maps.map(m => (m.has(t) ? String(m.get(t)) : ""))].join(","));
  return lines.join("\r\n") + "\r\n";
}
export const fileName = (title, ext) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "." + ext;

// Colour shades for the same metric from several machines: the metric's colour, then lighter and darker steps. Returns an hsl() string.
export function shade(hex, i) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, L = [0, .18, -.16, .3, -.28][i % 5];
  return `hsl(${Math.round(h * 60)} ${Math.round(s * 100)}% ${Math.round(Math.min(.85, Math.max(.25, l + L)) * 100)}%)`;
}
