export const SPARK = { w: 60, h: 14, maxPts: 60 };
// A tiny line for a folded bar. `pts` is [[time, value], ...]; `max` is the top of the scale (0 = scale to the data).
// Returns an SVG path string, or "" with fewer than two points.
export function sparkPath(pts, max = 100, w = SPARK.w, h = SPARK.h) {
  if (!pts || pts.length < 2) return "";
  const step = Math.max(1, Math.ceil(pts.length / SPARK.maxPts)), a = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  const top = max || Math.max(...a.map(p => p[1])) || 1;
  return a.map((p, i) => `${i ? "L" : "M"}${(i / (a.length - 1) * w).toFixed(1)} ${(h - 1 - Math.min(1, Math.max(0, p[1]) / top) * (h - 2)).toFixed(1)}`).join("");
}
