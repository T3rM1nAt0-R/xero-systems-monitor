import { useState } from "react";
import * as api from "./api.js";
import Sub from "./Sub.jsx";
import { runnerRows, queueRows, bytesText, STATUS_TEXT } from "./runnerList.js";
// The Runners tab's top: one row per runner (status, current job, time in the job, work folder size on demand) and the queue of waiting jobs.
export default function RunnerList({ machine, d, started, gone, now }) {
  const [sizes, setSizes] = useState({}), [state, setState] = useState("");   // state: "", "loading" or an error text
  const ask = () => { setState("loading"); api.getWorkSize(machine).then(list => { setSizes(Object.fromEntries(list.map(x => [x.runner, x.bytes]))); setState(""); }, e => setState(String(e?.message || e))); };
  const rows = runnerRows(d, started, gone, now, sizes), queue = queueRows(d, now);
  return (
    <>
      <Sub id={machine + ".rlist"} title="Runners" hint={`${rows.length}`}>
        <div className="rlist" role="table" aria-label="Runners">
          {rows.map(r => <div className="rrow" role="row" key={r.name}>
            <span className={"rname " + r.status} role="cell"><i />{r.name}</span><span className="rst" role="cell">{STATUS_TEXT[r.status]}</span>
            <span className="rjob" role="cell">{r.job || "–"}</span><span className="rt" role="cell">{r.inJob}</span>
            <span className="rsz" role="cell">{r.size !== undefined ? bytesText(r.size) : ""}</span>
          </div>)}
          <div className="rfoot"><button className="ghost" disabled={state === "loading"} onClick={ask} data-tip="Adds up each runner's work folder. Can take a few seconds.">{state === "loading" ? "Measuring…" : "Check work folder sizes"}</button>{state && state !== "loading" && <span className="quiet">{state}</span>}</div>
        </div>
      </Sub>
      <Sub id={machine + ".rqueue"} title="Queue" hint={d.queued ? `${queue.length} waiting` : ""}>
        {d.queued ? (queue.length ? <div className="rlist">{queue.map(q => <div className="rrow q" key={q.label + q.since}><span className="rjob">{q.label}</span><span className="rt">waiting {q.waited}</span></div>)}</div> : <div className="quiet">Nothing is waiting for these runners.</div>)
          : <div className="quiet">This machine does not report waiting jobs.</div>}
      </Sub>
    </>);
}
