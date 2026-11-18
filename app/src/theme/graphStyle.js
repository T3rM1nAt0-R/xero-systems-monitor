// Path text for one graph series in the chosen style. `pts` are [time, value]; `x(t)` and `y(v)` give plot coordinates; `bottom` is the plot's bottom edge.
// style: "line" | "area" | "bars"; smooth: curves through the points instead of straight pieces. Returns { l, a } (the line or the bars, and the closed area under it).
const f = n => n.toFixed(1);
const BAR_FILL = 0.7;   // how much of the space between two points a bar takes
const CURVE = 6;        // Catmull-Rom to Bezier: the control point sits one sixth of the neighbour span away

function curve(p, bottom) {
  const clamp = v => Math.min(bottom, Math.max(0, v));
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [p0, p1, p2, p3] = [p[Math.max(0, i - 1)], p[i], p[i + 1], p[Math.min(p.length - 1, i + 2)]];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / CURVE)} ${f(clamp(p1[1] + (p2[1] - p0[1]) / CURVE))} ${f(p2[0] - (p3[0] - p1[0]) / CURVE)} ${f(clamp(p2[1] - (p3[1] - p1[1]) / CURVE))} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
function bars(p, bottom) {
  const gap = p.length > 1 ? Math.min(...p.slice(1).map((q, i) => q[0] - p[i][0]).filter(g => g > 0), Infinity) : 0, w = Math.max(1, (Number.isFinite(gap) ? gap : 1) * BAR_FILL);
  return p.map(([x, y]) => `M${f(x - w / 2)} ${f(bottom)}V${f(y)}h${f(w)}V${f(bottom)}Z`).join("");
}
export function seriesPaths(pts, { x, y, bottom, style = "line", smooth = false }) {
  if (pts.length < 2) return null;
  const p = pts.map(([t, v]) => [x(t), y(v)]);
  if (style === "bars") return { l: bars(p, bottom), a: "" };
  const l = smooth ? curve(p, bottom) : p.map(([px, py], i) => (i ? "L" : "M") + f(px) + " " + f(py)).join("");
  return { l, a: `${l}L${f(p[p.length - 1][0])} ${f(bottom)}L${f(p[0][0])} ${f(bottom)}Z` };
}
