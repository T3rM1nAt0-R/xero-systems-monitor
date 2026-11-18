import { memo, useEffect, useId, useMemo, useRef } from "react";
import { axisTicks } from "./format.js";
import Axis from "./Axis.jsx";
import { join, hoverAt, hoverEnd } from "./hoverGroup.js";
import { clipSeries, zoomRange } from "./graphTools.js";
import { setZoom } from "./graphView.js";
// Full-size graph with hover readout. The hover is moved straight in the DOM (no React render per mouse move).
function nearest(pts, t) {
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] < t) lo = m; else hi = m; }
  return Math.abs(pts[lo][0] - t) <= Math.abs(pts[hi][0] - t) ? pts[lo] : pts[hi];
}
function Chart({ series, t0, t1, max, unit = "", fmt, thr, thrLabel, range, marks = [], group, title, cmp, cmpLabel = "", zoomable = true, live = true }) {
  const W = 600, H = 150, root = useRef(null), x = useRef(null), sel = useRef(null), raf = useRef(0), cx = useRef(0), cy = useRef(0);
  const top = useMemo(() => max || Math.max(1, ...series.flatMap(s => s.pts.map(p => p[1])), ...(cmp || []).map(p => p[1])) * 1.15, [series, max, cmp]);
  const X = t => Math.max(0, Math.min(W, ((t - t0) / (t1 - t0)) * W)).toFixed(1);
  const line = pts => pts.map(([t, v], i) => (i ? "L" : "M") + X(t) + " " + (H - Math.min(1, v / top) * H).toFixed(1)).join("");
  const cmpPath = useMemo(() => { const c = cmp ? clipSeries(cmp, t0, t1) : []; return c.length > 1 ? line(c) : null; }, [cmp, t0, t1, top]);   // the faint dashed copy from an earlier day
  const paths = useMemo(() => series.map(s => {
    const pts = clipSeries(s.pts, t0, t1);   // zoomed in: only what is inside the window, cut exactly at its edges
    if (pts.length < 2) return null;
    const l = pts.map(([t, v], i) => (i ? "L" : "M") + X(t) + " " + (H - Math.min(1, v / top) * H).toFixed(1)).join("");
    return { l, a: `${l}L${X(pts[pts.length - 1][0])} ${H}L${X(pts[0][0])} ${H}Z` };
  }), [series, t0, t1, top]);
  const f = fmt || (v => v.toFixed(0) + unit);
  const ticks = axisTicks(t0, t1, 3), pct = t => ((t - t0) / (t1 - t0)) * 100;
  const latest = useRef(); latest.current = { series, f, t0, t1, cmp, cmpLabel };
  const id = useId(), g = group || id;
  useEffect(() => join(g, id, {   // this graph's side of the shared hover
    title: title || series[0]?.name, color: series[0]?.color, el: () => root.current,
    value: t => { const { series: ss, f: ff } = latest.current; const hit = ss.filter(s => s.pts.length).map(s => (ss.length > 1 ? s.name + " " : "") + ff(nearest(s.pts, t)[1])); const c = latest.current.cmp; if (c?.length && hit.length && t >= c[0][0] && t <= c[c.length - 1][0]) hit.push(latest.current.cmpLabel + " " + ff(nearest(c, t)[1])); return hit.length ? hit.join(" · ") : null; },
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
  const share = e => { const r = root.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  const show = (a, b) => { const el = sel.current; if (!el) return; el.style.left = Math.min(a, b) * 100 + "%"; el.style.width = Math.abs(b - a) * 100 + "%"; el.style.opacity = a === b ? 0 : 1; };
  const down = e => {   // drag across the graph to zoom every graph of this machine to that span
    if (!zoomable || e.button !== 0) return; const a = share(e); show(a, a);
    const up = ev => { window.removeEventListener("mouseup", up); window.removeEventListener("mousemove", mv); const b = share(ev); show(0, 0); const z = zoomRange(t0, t1, a, b); if (z) setZoom(g, z); };
    const mv = ev => show(a, share(ev));
    window.addEventListener("mouseup", up); window.addEventListener("mousemove", mv);
  };
  return (
    <div>
      <div className="chart" ref={root} onMouseMove={move} onMouseLeave={leave} onMouseDown={down} onDoubleClick={() => zoomable && setZoom(g, null)} role="img" aria-label={series.map(s => s.name).join(" and ")}>
        {ticks.map(t => <i key={t} className="vg" style={{ left: pct(t) + "%" }} />)}
        {[.5, 1].map(q => <div key={q} className="gl" style={{ bottom: q * 100 + "%" }}><span>{f(top * q).replace(/\.\d/, "")}</span></div>)}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {paths[0] && series.length === 1 && <path d={paths[0].a} style={{ fill: series[0].color, stroke: "none", opacity: .08 }} />}
          {cmpPath && <path className="cmp" d={cmpPath} style={{ stroke: series[0].color }} />}
          {[...series].reverse().map((s, i) => { const p = paths[series.length - 1 - i]; return p && <path key={s.name} d={p.l} style={{ stroke: s.color }} />; })}
        </svg>
        {thr != null && thr <= top && <div className="thr" style={{ bottom: (thr / top) * 100 + "%" }}><span>{thrLabel}</span></div>}
        {marks.map((m, i) => m.t >= t0 && <div key={i} className="ev" data-tip={m.text} style={{ left: ((m.t - t0) / (t1 - t0)) * 100 + "%" }} />)}
        <div className="x" ref={x} /><div className="sel" ref={sel} />
      </div>
      <Axis t0={t0} t1={t1} range={range} live={live} />
    </div>
  );
}
export default memo(Chart);
