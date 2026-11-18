import { isWarn } from "./format.js";
import { sparkPath } from "./spark.js";
import { metricVar } from "./colors.js";
import { miniTiles, miniChip } from "./miniTiles.js";
import StatusDot from "./StatusDot.jsx";
const SW = 60, SH = 16;   // the sparkline's drawing box (it stretches to the tile's width)
const Tile = ({ t, pts, warn }) => {
  const line = sparkPath(pts, t.max, SW, SH);
  return (
    <div className={"mini-tile" + (warn ? " warn" : "")} style={{ "--mc": metricVar(t.k) }}>
      <small>{t.label}</small>
      <b>{t.text}{t.unit && <i>{t.unit}</i>}</b>
      <svg viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" aria-hidden="true">{line && <path d={line} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}</svg>
    </div>);
};
// The mini window: one glass surface, one tight row per machine (status dot and name, then number tiles with a tiny line each). Colour is only for data.
// An alert chip shows only when something needs a look. The columns reflow by width (styles/mini.css).
export default function MiniView({ ms, hist, limitsOf, now, lastOk, hot }) {
  return (
    <div className="mini-list">
      {ms.map(m => {
        const d = m.d || {}, lm = limitsOf(m.name), h = hist[m.name] || {}, chip = miniChip(m, lm, hot[m.name]?.cpu, lastOk[m.name], now);
        return (
          <section className={"mini-row" + (m.err ? " off" : "")} key={m.name}>
            <header><StatusDot off={!!m.err} warn={!!chip} /><b>{m.name}</b>{chip && <span className={"mini-chip" + (m.err ? " off" : "")}>{chip}</span>}</header>
            {!m.err && <div className="mini-tiles">{miniTiles(d).map(t => <Tile key={t.k} t={t} pts={(h[t.k] || []).slice(-SW)} warn={isWarn(t.k, t.v, lm)} />)}</div>}
          </section>);
      })}
    </div>);
}
