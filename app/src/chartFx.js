// The pure decisions behind the graph's motion.
export const CROSS_GLOW_MS = 1800, STRETCH_MS = 420, WAIT_MS = 4000;   // WAIT_MS: how long after a range change the new data may still arrive and draw in
const MAX_SLIDE = 0.25;   // a jump of more than a quarter of the graph (the window was asleep) just redraws
const SAME_SPAN = 0.02;   // a span that changes by less than 2% is the same range
// What should the graph do now? `p` is what it drew last time ({ t0, t1, ready }) or null.
// "first": it just got data. "stretch": the range changed. "slide": time moved on. "": nothing.
export function fxKind(p, { t0, t1, ready }) {
  if (!ready) return "";
  if (!p || !p.ready) return "first";
  const span = t1 - t0, was = p.t1 - p.t0;
  if (!(span > 0) || !(was > 0)) return "";
  if (Math.abs(span / was - 1) > SAME_SPAN) return "stretch";
  return t1 > p.t1 && (t1 - p.t1) / span < MAX_SLIDE ? "slide" : "";
}
// Which way a number rolls: 1 when it went up (the new text comes in from below), -1 when it went down. Text that is not a number goes up.
const num = t => { const m = /^-?\d+(?:\.\d+)?/.exec(t || ""); return m ? +m[0] : null; };
export function rollDir(a, b) { const x = num(a), y = num(b); return x != null && y != null && y < x ? -1 : 1; }
// The stops of a line's heat colour, as [offset 0 to 1 of the graph height, which colour]: the line's own colour, warming toward the limit, red above it.
const WARM_FROM = 0.6;   // the warming starts at 60% of the limit
export function heatStops(thr, top) {
  const f = thr / top;
  if (!(f > 0) || f > 1) return null;
  return [[0, "own"], [f * WARM_FROM, "own"], [f, "warn"], [f, "bad"], [1, "bad"]];
}
// The highest point inside [t0, t1] of several series ([[t, v], ...] each): { t, v, i } (i is the series) or null.
export function peakOf(seriesPts, t0, t1) {
  let best = null;
  seriesPts.forEach((pts, i) => { for (const [t, v] of pts) if (t >= t0 && t <= t1 && (!best || v > best.v)) best = { t, v, i }; });
  return best;
}
// The newest point inside [t0, t1] of one series, or null.
export function newest(pts, t0, t1) {
  for (let i = pts.length - 1; i >= 0; i--) if (pts[i][0] <= t1) return pts[i][0] >= t0 ? { t: pts[i][0], v: pts[i][1] } : null;
  return null;
}
