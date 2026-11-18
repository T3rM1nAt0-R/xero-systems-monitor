import { peakOf, newest } from "./chartFx.js";
// The layer over a graph's line: a glowing dot on each newest point and a small floating label on the highest visible point.
// It is one element so it slides with the line (see useChartFx); positions are percentages, so they need no measuring.
const NEAR_NOW = 0.05;   // a peak this close to the newest point is not worth a second label
export default function ChartMarks({ layer, series, t0, t1, top, f, peak = true }) {
  const dots = series.map(s => ({ s, p: s.pts.length ? newest(s.pts, t0, t1) : null })).filter(d => d.p);
  const top1 = peak ? peakOf(series.map(s => s.pts), t0, t1) : null, hi = top1 && top1.t < t1 - (t1 - t0) * NEAR_NOW ? top1 : null, at = p => ({ left: ((p.t - t0) / (t1 - t0)) * 100 + "%", bottom: Math.min(1, p.v / top) * 100 + "%" });
  const q = hi ? (hi.t - t0) / (t1 - t0) : 0, edge = q < 0.1 ? " l" : q > 0.9 ? " r" : "", low = hi && hi.v / top > 0.8 ? " low" : "";
  return (
    <div className="fxl" ref={layer} aria-hidden="true">
      {dots.map(({ s, p }) => <i key={s.name} className="head" style={{ ...at(p), "--c": s.color }}><u /></i>)}
      {hi && <b className={"peak" + edge + low} style={{ ...at(hi), color: series[hi.i].color }}>{f(hi.v)}</b>}
    </div>);
}
