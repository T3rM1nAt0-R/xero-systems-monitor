import { useMemo } from "react";
import { dur, hm } from "./format.js";
import { buildLanes, BAD } from "./lanes.js";
import Axis from "./Axis.jsx";
import Ticker from "./Ticker.jsx";
export default function Timeline({ machine, rows, runners, jobs, started, t0, t1, range }) {
  const lanes = useMemo(() => buildLanes(rows, machine, runners, jobs, started, t0, t1), [machine, rows, runners, jobs, started, t0, t1]);
  const pos = t => Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100));
  if (!lanes.length) return <div className="quiet">No jobs in this period.</div>;
  return (
    <div className="tl">
      {lanes.map(([r, bars]) => (
        <div key={r} className="lane"><Ticker text={r} />
          <div className="track">{bars.filter(b => b.e >= t0).map((b, i) => (
            <div key={i} className={"jb" + (b.run ? " run" : "") + (b.res && BAD[b.res] ? " " + BAD[b.res] : "")} data-tip={[b.label || "Job", `${b.res ? b.res + " · " : ""}${hm(b.s)} to ${b.run ? "now" : hm(b.e)} · ${dur(b.e - b.s)}${b.run ? " so far" : ""}`, r].join("\n")} style={{ left: pos(b.s) + "%", width: pos(b.e) - pos(b.s) + "%" }}><span className="jl">{b.label}</span></div>))}</div>
        </div>))}
      <Axis t0={t0} t1={t1} range={range} className="tlx" />
    </div>
  );
}
