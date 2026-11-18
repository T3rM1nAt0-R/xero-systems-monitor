import { useMemo } from "react";
import { stripCells, STRIP_SPANS } from "./outage.js";
// A thin strip of the last 24 hours or 7 days: online (green), offline (red), no data (grey). Hover a stretch for its times.
export default function OutageStrip({ machine, events, pts, now, offNow, span, onSpan }) {
  const minute = Math.floor(now / 60);
  const cells = useMemo(() => stripCells({ events, pts, machine, now, span, offNow }), [events, pts, machine, minute, span, offNow]);   // eslint-disable-line react-hooks/exhaustive-deps -- the strip only moves once a minute
  return (
    <div className="outage" role="group" aria-label={`Online history of ${machine}`}>
      <div className={"ostrip" + (cells.every(c => c.status === "on") ? " calm" : "")} role="img" aria-label={cells.map(c => c.text).join(", ")}>{cells.map(c => <i key={c.a} className={c.status} style={{ width: c.w + "%" }} data-tip={c.text} />)}</div>
      <div className="seg" role="group" aria-label="Strip length">{Object.entries(STRIP_SPANS).map(([k, v]) => <button key={k} className={span === k ? "on" : ""} onClick={() => onSpan(k)}>{v.label}</button>)}</div>
    </div>);
}
