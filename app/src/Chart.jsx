import { memo, useEffect, useId, useMemo, useRef } from "react";
import { axisTicks } from "./format.js";
import Axis from "./Axis.jsx";
import { join, hoverAt, hoverEnd } from "./hoverGroup.js";
// Full-size graph with hover readout. The hover is moved straight in the DOM (no React render per mouse move).
function nearest(pts, t) {
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] < t) lo = m; else hi = m; }
  return Math.abs(pts[lo][0] - t) <= Math.abs(pts[hi][0] - t) ? pts[lo] : pts[hi];
}
function Chart({ series, t0, t1, max, unit = "", fmt, thr, thrLabel, range, marks = [], group, title }) {
  const W = 600, H = 150, root = useRef(null), x = useRef(null), raf = useRef(0), cx = useRef(0), cy = useRef(0);
  const top = useMemo(() => max || Math.max(1, ...series.flatMap(s => s.pts.map(p => p[1]))) * 1.15, [series, max]);
  const paths = useMemo(() => series.map(s => {
    if (s.pts.length < 2) return null;
    const X = t => Math.max(0, Math.min(W, ((t - t0) / (t1 - t0)) * W)).toFixed(1);   // points just outside the window are pinned to its edge
    const l = s.pts.map(([t, v], i) => (i ? "L" : "M") + X(t) + " " + (H - Math.min(1, v / top) * H).toFixed(1)).join("");
    return { l, a: `${l}L${X(s.pts[s.pts.length - 1][0])} ${H}L${X(s.pts[0][0])} ${H}Z` };
  }), [series, t0, t1, top]);
  const f = fmt || (v => v.toFixed(0) + unit);
  const ticks = axisTicks(t0, t1, 3), pct = t => ((t - t0) / (t1 - t0)) * 100;
  const latest = useRef(); latest.current = { series, f, t0, t1 };
  const id = useId(), g = group || id;
  useEffect(() => join(g, id, {   // this graph's side of the shared hover
    title: title || series[0]?.name, color: series[0]?.color, el: () => root.current,
    value: t => { const { series: ss, f: ff } = latest.current; const hit = ss.filter(s => s.pts.length).map(s => (ss.length > 1 ? s.name + " " : "") + ff(nearest(s.pts, t)[1])); return hit.length ? hit.join(" · ") : null; },
    mark: t => { const el = x.current, r = root.current; if (!el || !r) return; const { t0: a, t1: b } = latest.current, q = (t - a) / (b - a); if (t == null || q < 0 || q > 1) { el.style.opacity = 0; return; } el.style.transform = `translateX(${q * r.offsetWidth}px)`; el.style.opacity = 1; },
  }), [g, id, title, series[0]?.color]);
  const move = e => {
    cx.current = e.clientX; cy.current = e.clientY; if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0; const el = root.current; if (!el) return;
      const r = el.getBoundingClientRect(), q = Math.min(1, Math.max(0, (cx.current - r.left) / r.width));
      hoverAt(g, t0 + q * (t1 - t0), cx.current, cy.current, range);
    });
  };
  const leave = () => { cancelAnimationFrame(raf.current); raf.current = 0; hoverEnd(g); };
  return (
    <div>
      <div className="chart" ref={root} onMouseMove={move} onMouseLeave={leave} role="img" aria-label={series.map(s => s.name).join(" and ")}>
        {ticks.map(t => <i key={t} className="vg" style={{ left: pct(t) + "%" }} />)}
        {[.5, 1].map(q => <div key={q} className="gl" style={{ bottom: q * 100 + "%" }}><span>{f(top * q).replace(/\.\d/, "")}</span></div>)}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {paths[0] && series.length === 1 && <path d={paths[0].a} style={{ fill: series[0].color, stroke: "none", opacity: .08 }} />}
          {[...series].reverse().map((s, i) => { const p = paths[series.length - 1 - i]; return p && <path key={s.name} d={p.l} style={{ stroke: s.color }} />; })}
        </svg>
        {thr != null && thr <= top && <div className="thr" style={{ bottom: (thr / top) * 100 + "%" }}><span>{thrLabel}</span></div>}
        {marks.map((m, i) => m.t >= t0 && <div key={i} className="ev" data-tip={m.text} style={{ left: ((m.t - t0) / (t1 - t0)) * 100 + "%" }} />)}
        <div className="x" ref={x} />
      </div>
      <Axis t0={t0} t1={t1} range={range} />
    </div>
  );
}
export default memo(Chart);
