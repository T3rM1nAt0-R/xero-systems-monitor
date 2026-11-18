import { memo, useEffect, useId, useMemo, useRef } from "react";
import { axisTicks } from "./format.js";
import Axis from "./Axis.jsx";
import { join, hoverAt, hoverEnd } from "./hoverGroup.js";
import { clipSeries, zoomRange, isClick } from "./graphTools.js";
import { setZoom } from "./graphView.js";
import { seriesPaths } from "./theme/graphStyle.js";
import useGraphLook from "./theme/useGraphLook.js";
// Full-size graph with hover readout. The hover is moved straight in the DOM (no React render per mouse move).
function nearest(pts, t) {
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] < t) lo = m; else hi = m; }
  return Math.abs(pts[lo][0] - t) <= Math.abs(pts[hi][0] - t) ? pts[lo] : pts[hi];
}
function Chart({ series, t0, t1, max, unit = "", fmt, thr, thrLabel, range, marks = [], group, title, cmp, cmpLabel = "", zoomable = true, live = true, onPick }) {
  const W = 600, H = 150, look = useGraphLook(), root = useRef(null), x = useRef(null), sel = useRef(null), raf = useRef(0), cx = useRef(0), cy = useRef(0), downAt = useRef(null);
  const top = useMemo(() => max || Math.max(1, ...series.flatMap(s => s.pts.map(p => p[1])), ...(cmp || []).map(p => p[1])) * 1.15, [series, max, cmp]);
  const X = t => Math.max(0, Math.min(W, ((t - t0) / (t1 - t0)) * W)).toFixed(1);
  const line = pts => pts.map(([t, v], i) => (i ? "L" : "M") + X(t) + " " + (H - Math.min(1, v / top) * H).toFixed(1)).join("");
  // X and line are rebuilt each render from t0, t1 and top, so those three are the real inputs of the two memos below.
  const cmpPath = useMemo(() => { const c = cmp ? clipSeries(cmp, t0, t1) : []; return c.length > 1 ? line(c) : null; }, [cmp, t0, t1, top]);   // eslint-disable-line react-hooks/exhaustive-deps -- line() only reads t0, t1 and top; the faint dashed copy from an earlier day
  const paths = useMemo(() => series.map(s => seriesPaths(clipSeries(s.pts, t0, t1), { x: t => +X(t), y: v => H - Math.min(1, v / top) * H, bottom: H, style: look.style, smooth: look.smooth })), [series, t0, t1, top, look.style, look.smooth]);   // eslint-disable-line react-hooks/exhaustive-deps -- X() only reads t0 and t1; zoomed in, only what is inside the window is drawn, cut exactly at its edges
  const f = fmt || (v => v.toFixed(0) + unit);
  const ticks = axisTicks(t0, t1, 3), pct = t => ((t - t0) / (t1 - t0)) * 100;
  const latest = useRef(); latest.current = { series, f, t0, t1, cmp, cmpLabel };
  const id = useId(), g = group || id, color0 = series[0]?.color;
  useEffect(() => join(g, id, {   // this graph's side of the shared hover
    title: title || series[0]?.name, color: color0, el: () => root.current,
    value: t => { const { series: ss, f: ff } = latest.current; const hit = ss.filter(s => s.pts.length).map(s => (ss.length > 1 ? s.name + " " : "") + ff(nearest(s.pts, t)[1])); const c = latest.current.cmp; if (c?.length && hit.length && t >= c[0][0] && t <= c[c.length - 1][0]) hit.push(latest.current.cmpLabel + " " + ff(nearest(c, t)[1])); return hit.length ? hit.join(" · ") : null; },
    mark: t => { const el = x.current, r = root.current; if (!el || !r) return; const { t0: a, t1: b } = latest.current, q = (t - a) / (b - a); if (t == null || q < 0 || q > 1) { el.style.opacity = 0; return; } el.style.transform = `translateX(${q * r.offsetWidth}px)`; el.style.opacity = 1; },
  }), [g, id, title, color0]);   // eslint-disable-line react-hooks/exhaustive-deps -- title falls back to series[0].name; the readout is re-read from `latest` on every move
  const move = e => {
    cx.current = e.clientX; cy.current = e.clientY; if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0; const el = root.current; if (!el) return;
      const r = el.getBoundingClientRect(), q = Math.min(1, Math.max(0, (cx.current - r.left) / r.width));
      hoverAt(g, t0 + q * (t1 - t0), cx.current, cy.current, range);
    });
  };
  // A click (the pointer barely moved since it went down) picks that moment: onPick(t, x, y). Dragging is not a click.
  const pick = e => {
    const el = root.current; if (!onPick || !el || !isClick(downAt.current, e.clientX, e.clientY)) return;
    const r = el.getBoundingClientRect(); onPick(t0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (t1 - t0), e.clientX, e.clientY);
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
      <div className={"chart" + (onPick ? " pick" : "")} ref={root} onMouseMove={move} onMouseLeave={leave} onMouseDown={e => { downAt.current = [e.clientX, e.clientY]; down(e); }} onClick={pick} onDoubleClick={() => zoomable && setZoom(g, null)} role="img" aria-label={series.map(s => s.name).join(" and ")}>
        {ticks.map(t => <i key={t} className="vg" style={{ left: pct(t) + "%" }} />)}
        {[.5, 1].map(q => <div key={q} className="gl" style={{ bottom: q * 100 + "%" }}><span>{f(top * q).replace(/\.\d/, "")}</span></div>)}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {paths[0] && paths[0].a && (series.length === 1 || look.style === "area") && [...series].reverse().map((s, i) => { const p = paths[series.length - 1 - i]; return p && <path key={s.name} d={p.a} style={{ fill: s.color, stroke: "none", opacity: "var(--area-op)" }} />; })}
          {cmpPath && <path className="cmp" d={cmpPath} style={{ stroke: series[0].color }} />}
          {[...series].reverse().map((s, i) => { const p = paths[series.length - 1 - i]; return p && <path key={s.name} d={p.l} className={look.style === "bars" ? "bars" : undefined} style={look.style === "bars" ? { fill: s.color } : { stroke: s.color }} />; })}
        </svg>
        {thr != null && thr <= top && <div className="thr" style={{ bottom: (thr / top) * 100 + "%" }}><span>{thrLabel}</span></div>}
        {marks.map((m, i) => m.t >= t0 && m.t <= t1 && <div key={i} className={"ev " + (m.kind || "")} style={{ left: ((m.t - t0) / (t1 - t0)) * 100 + "%" }}><b data-tip={m.text} /></div>)}
        <div className="x" ref={x} /><div className="sel" ref={sel} />
      </div>
      <Axis t0={t0} t1={t1} range={range} live={live} />
    </div>
  );
}
export default memo(Chart);
