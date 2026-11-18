import Sub from "./Sub.jsx";
import { queueRows } from "./runnerList.js";
// The jobs waiting for one of this machine's runners, longest wait first.
export default function Queue({ machine, d, now }) {
  const queue = queueRows(d, now);
  return (
    <Sub id={machine + ".rqueue"} title="Queue" hint={d.queued ? `${queue.length} waiting` : ""}>
      {d.queued ? (queue.length ? <div className="rlist">{queue.map(q => <div className="rrow q" key={q.label + q.since}><span className="rjob">{q.label}</span><span className="rt">waiting {q.waited}</span></div>)}</div> : <div className="quiet">Nothing is waiting for these runners.</div>)
        : <div className="quiet">This machine does not report waiting jobs.</div>}
    </Sub>);
}
