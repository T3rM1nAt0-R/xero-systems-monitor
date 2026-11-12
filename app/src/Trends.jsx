import { useMemo } from "react";
import { jobTrends } from "./trends.js";
import { since } from "./format.js";
const mm = m => m < 1 ? "<1 min" : m < 90 ? Math.round(m) + " min" : (m / 60).toFixed(1) + " h";
// "Last 7 days": which workflows take the time, whether they got slower than the week before, and the slowest jobs.
export default function Trends({ rows, machine, now }) {
  const tr = useMemo(() => jobTrends(rows, machine, Math.floor(now)), [rows, machine, Math.floor(now / 300)]);
  if (!tr.workflows.length) return null;
  return (
    <div className="trends">
      <h4>Last 7 days</h4>
      <div className="trow head"><span>Workflow</span><span>Runs</span><span>Average</span><span>vs week before</span></div>
      {tr.workflows.map(w => <div className="trow" key={w.name}><span data-tip={w.name}>{w.name}{w.failed > 0 && <em className="bad"> · {w.failed} failed</em>}</span><span>{w.runs}</span><span>{mm(w.avg)}</span>
        <span className={w.change == null ? "dim" : w.change > 0.15 ? "slower" : w.change < -0.15 ? "faster" : "dim"}>{w.change == null ? "–" : `${w.change > 0 ? "▲" : "▼"} ${Math.abs(Math.round(w.change * 100))}%`}</span></div>)}
      <h4>Slowest jobs</h4>
      {tr.slow.map((j, i) => <div className="trow slow" key={i}><span data-tip={j.label}>{j.label}</span><span>{mm(j.mins)}</span><span className="dim">{j.runner} · {since(j.t)} ago</span></div>)}
    </div>);
}
