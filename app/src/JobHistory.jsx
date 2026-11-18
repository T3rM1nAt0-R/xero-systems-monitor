import { useMemo, useState } from "react";
import { historyRows, filterHistory, workflowsOf, RESULT_FILTERS } from "./history.js";
import { dur, when } from "./format.js";
import { linkProps, linkClass } from "./jobLink.js";
import Sub from "./Sub.jsx";
const THREE_DAYS = 86400 * 3;   // makes `when` show the date as well as the 12-hour time
// "Job history": the last 100 jobs of this machine, newest first. Search, filter by result or workflow; a click opens the job on GitHub.
export default function JobHistory({ rows, machine }) {
  const [q, setQ] = useState(""), [kind, setKind] = useState("all"), [flow, setFlow] = useState("");
  const all = useMemo(() => historyRows(rows, machine), [rows, machine]);
  const flows = useMemo(() => workflowsOf(all), [all]);
  const shown = useMemo(() => filterHistory(all, { q, kind, flow }), [all, q, kind, flow]);
  if (!all.length) return null;
  return (
    <div className="hist"><Sub id={machine + ".history"} def={false} title="Job history" hint={`last ${all.length} jobs`}>
      <div className="hfilters">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search jobs" aria-label="Search jobs" />
        <select value={kind} onChange={e => setKind(e.target.value)} aria-label="Result">{RESULT_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={flow} onChange={e => setFlow(e.target.value)} aria-label="Workflow"><option value="">All workflows</option>{flows.map(f => <option key={f} value={f}>{f}</option>)}</select>
      </div>
      <div className="hlist">
        {shown.map((j, i) => <div key={i} className={"hitem" + linkClass(j.url)} data-tip={[j.label, j.url && "Click to open on GitHub"].filter(Boolean).join("\n")} {...linkProps(j.url)}>
          <span>{j.label}</span><span className="rn">{j.runner}</span><span className={j.kind}>{j.res || "Unknown"}</span><span className="tk">{dur(j.t1 - j.t0)}</span><span>{when(j.t1, THREE_DAYS)}</span></div>)}
        {!shown.length && <div className="quiet">No jobs match.</div>}
      </div>
    </Sub></div>);
}
