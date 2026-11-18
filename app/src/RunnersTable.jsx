import { useMemo, useState } from "react";
import * as api from "./api.js";
import Sub from "./Sub.jsx";
import Axis from "./Axis.jsx";
import { dur, hm } from "./format.js";
import { runnerRows, STATUS_TEXT, bytesText } from "./runnerList.js";
import { buildLanes, BAD } from "./lanes.js";
import { labelUrl, refUrl } from "./github.js";
import { linkProps, linkClass } from "./jobLink.js";
const res = v => !v ? "" : [v[0] != null && `CPU ${v[0].toFixed(0)}%`, v[1] != null && `RAM ${(v[1] / 1024).toFixed(1)} GB`, (v[2] != null || v[3] != null) && "GPU " + [v[3] != null && v[3].toFixed(0) + "%", v[2] != null && v[2].toFixed(0) + " MB"].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
const WORD = { busy: "Busy", idle: "Idle", gone: "Offline" };
// One lane: the runner's own job bars on the shared time axis. A bar opens its job on GitHub when it has an address.
function Lane({ name, bars, t0, t1 }) {
  const pos = t => Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100));
  return (
    <div className="rtlane">{bars.filter(b => b.e >= t0).map((b, i) => { const url = b.url || labelUrl(b.label); return (
      <div key={i} {...linkProps(url)} className={"jb" + linkClass(url) + (b.run ? " run" : "") + (b.res && BAD[b.res] ? " " + BAD[b.res] : "")} data-tip={[b.label || "Job", ...(url ? ["Click to open on GitHub"] : []), `${b.res ? b.res + " · " : ""}${hm(b.s)} to ${b.run ? "now" : hm(b.e)} · ${dur(b.e - b.s)}${b.run ? " so far" : ""}`, name].join("\n")} style={{ left: pos(b.s) + "%", width: Math.max(pos(b.e) - pos(b.s), 0.4) + "%" }} />); })}</div>);
}
// The runners as one table: a row per runner (status dot, name, status, current job, time in the job) and that runner's own timeline lane
// filling the rest of the row, with one shared time axis at the bottom. `compact` (Overview) drops the status and time columns.
export default function RunnersTable({ machine, d, started, gone, now, span: secs, finished, compact }) {
  const t0 = now - secs;   // the timeline shows the same time as the graphs ("Graphs show" at the bottom)
  const [sizes, setSizes] = useState({}), [state, setState] = useState("");   // state: "", "loading" or an error text
  const ask = () => { setState("loading"); api.getWorkSize(machine).then(list => { setSizes(Object.fromEntries(list.map(x => [x.runner, x.bytes]))); setState(""); }, e => setState(String(e?.message || e))); };
  const rows = runnerRows(d, started, gone, now, sizes, finished, machine), jobs = d.jobs || {}, jr = d.jobres || {};
  const lanes = useMemo(() => Object.fromEntries(buildLanes(finished, machine, d.runners, d.jobs, started, t0, now)), [finished, machine, d.runners, d.jobs, started, t0, now]);
  const hasSize = !compact && Object.keys(sizes).length > 0;
  const body = (
    <>
      <div className={"rtable" + (compact ? " compact" : "") + (hasSize ? " hassz" : "")} role="table" aria-label="Runners">
        <div className="rtr rth" role="row">
          <span role="columnheader">Runner</span>{!compact && <span className="rst" role="columnheader">Status</span>}<span role="columnheader">Job</span>{!compact && <span className="rt" role="columnheader">Time</span>}{hasSize && <span className="rt" role="columnheader">Folder</span>}
          <span className="rtl" role="columnheader">Timeline</span>
        </div>
        {rows.map(r => { const j = jobs[r.name], url = j && refUrl(j[3], j[2]);
          return (
            <div className="rtr" role="row" key={r.name} data-tip={[r.name, j?.[3], res(jr[r.name])].filter(Boolean).join(" · ")}>
              <span className={"rname " + r.status} role="cell"><i /><span>{r.name}</span></span>
              {!compact && <span className={"rst " + r.status} role="cell">{WORD[r.status]}</span>}
              <span className={"rjob" + linkClass(url)} role="cell" {...linkProps(url)}>{r.job || (r.status === "gone" ? STATUS_TEXT.gone : r.note)}</span>
              {!compact && <span className="rt" role="cell">{r.inJob}</span>}
              {hasSize && <span className="rt" role="cell">{r.size !== undefined ? bytesText(r.size) : ""}</span>}
              <span className="rtl" role="cell"><Lane name={r.name} bars={lanes[r.name] || []} t0={t0} t1={now} /></span>
            </div>); })}
        <div className="rtr rtx"><span className="rtl"><Axis t0={t0} t1={now} range={secs} className="tlx" /></span></div>
      </div>
      {!compact && <div className="rfoot"><button className="small" disabled={state === "loading"} onClick={ask} data-tip="Adds up each runner's work folder. Can take a few seconds.">{state === "loading" ? "Measuring…" : "Check work folder sizes"}</button>{state && state !== "loading" && <span className="quiet">{state}</span>}</div>}
    </>);
  return compact ? body : <Sub id={machine + ".rtable"} title="Runners" hint={`${rows.length}`}>{body}</Sub>;   // the Overview already has the section heading
}
