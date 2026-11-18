import { useMemo } from "react";
import Sub from "./Sub.jsx";
import { jobTrends } from "./trends.js";
import { since } from "./format.js";
import { labelUrl } from "./github.js";
import { linkProps, linkClass } from "./jobLink.js";
const mm = m => m < 1 ? "<1 min" : m < 90 ? Math.round(m) + " min" : (m / 60).toFixed(1) + " h";
// "Last 7 days": which workflows take the time, whether they got slower than the week before, and the slowest jobs.
export default function Trends({ rows, machine, now }) {
  const tr = useMemo(() => jobTrends(rows, machine, Math.floor(now)), [rows, machine, Math.floor(now / 300)]);
  if (!tr.workflows.length) return null;
  return (
    <div className="trends">
      <Sub id={machine + ".t7"} title="Last 7 days">
      <div className="trow head"><span>Workflow</span><span>Runs</span><span>Average</span><span>vs week before</span></div>
      {tr.workflows.map(w => <div className="trow" key={w.name}><span data-tip={w.name}>{w.name}{w.failed > 0 && <em className="bad"> · {w.failed} failed</em>}</span><span>{w.runs}</span><span>{mm(w.avg)}</span>
        <span className={w.change == null ? "dim" : w.change > 0.15 ? "slower" : w.change < -0.15 ? "faster" : "dim"}>{w.change == null ? "–" : `${w.change > 0 ? "▲" : "▼"} ${Math.abs(Math.round(w.change * 100))}%`}</span></div>)}</Sub>
      <Sub id={machine + ".slow"} title="Slowest jobs">
      {tr.slow.map((j, i) => { const url = labelUrl(j.label); return <div className={"trow slow" + linkClass(url)} key={i} {...linkProps(url)}><span data-tip={j.label}>{j.label}</span><span>{mm(j.mins)}</span><span className="dim">{j.runner} · {since(j.t)} ago</span></div>; })}</Sub>
    </div>);
}
