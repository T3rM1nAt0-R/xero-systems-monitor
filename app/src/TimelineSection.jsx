import { useState } from "react";
import Sub from "./Sub.jsx";
import Timeline from "./Timeline.jsx";
import { TL_RANGES, DEFAULT_TL_RANGE } from "./lanes.js";
// The runners timeline with its own time range (last 24 h or 7 d), so it is never empty just because the page graphs show 5 minutes.
export default function TimelineSection({ machine, rows, runners, jobs, started, t1 }) {
  const [span, setSpan] = useState(DEFAULT_TL_RANGE), secs = TL_RANGES[span].secs;
  return (
    <Sub id={machine + ".tl"} title="Timeline">
      <div className="seg tlrange" role="group" aria-label="Timeline range">{Object.entries(TL_RANGES).map(([k, v]) => <button key={k} className={span === k ? "on" : ""} onClick={() => setSpan(k)}>{v.label}</button>)}</div>
      <Timeline machine={machine} rows={rows} runners={runners} jobs={jobs} started={started} t0={t1 - secs} t1={t1} range={secs} />
    </Sub>);
}
