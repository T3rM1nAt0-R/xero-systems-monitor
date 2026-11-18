import { useEffect, useRef, useState } from "react";
import HoldButton from "../HoldButton.jsx";
import ProgramHistory from "../ProgramHistory.jsx";
import { endTask } from "../api.js";
import { procRows, nextSort, SORTS, memText, cpuText } from "../procs.js";
// The Processes section: a live list of the busiest processes (sort by a column, filter by a word) with an End task button
// that must be held down, a small toast with the result, and the "What was busy" history underneath.
export default function Processes({ m, d }) {
  const [sort, setSort] = useState({ key: "cpu", desc: true }), [filter, setFilter] = useState(""), [toast, setToast] = useState(null), timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (text, bad) => { clearTimeout(timer.current); setToast({ text, bad }); timer.current = setTimeout(() => setToast(null), 5000); };
  const end = r => endTask(m.name, r.pid, r.name).then(t => say(t), e => say(String(e?.message || e), true));
  const rows = procRows(d.procs, { ...sort, filter }), total = d.procs?.length || 0, users = !!d.procs?.some(p => p[4]);
  return (
    <>
      <div className="procbar">
        <input type="search" className="procfilter" placeholder="Filter by name, user or ID" aria-label="Filter processes" value={filter} onChange={e => setFilter(e.target.value)} />
        <span className="quiet">{filter ? `${rows.length} of ${total}` : `The ${total} busiest right now`}</span>
      </div>
      <div className={"proctable" + (users ? " hasuser" : "")} role="table" aria-label="Running processes">
        <div className="prochead" role="row">
          {SORTS.filter(([k]) => k !== "user" || users).map(([k, title]) => (
            <button key={k} type="button" role="columnheader" className={"c-" + k + (sort.key === k ? " on" : "")} aria-sort={sort.key === k ? (sort.desc ? "descending" : "ascending") : "none"} onClick={() => setSort(s => nextSort(s, k))}>{title}{sort.key === k ? (sort.desc ? " ▾" : " ▴") : ""}</button>))}
          <span />
        </div>
        {rows.map(r => (
          <div className="procrow" role="row" key={r.pid}>
            <b className="c-name" data-tip={r.shown}>{r.shown}</b>
            <span className="c-pid">{r.pid}</span>
            {users && <span className="c-user">{r.user}</span>}
            <span className="c-cpu">{cpuText(r.cpu)}</span>
            <span className="c-ram">{memText(r.ram)}</span>
            <HoldButton label="End task" title={`Hold to end ${r.shown}`} onDone={() => end(r)} />
          </div>))}
        {rows.length === 0 && <p className="quiet">{filter ? "No program matches that." : "No process list yet."}</p>}
      </div>
      <div className={"ptoast" + (toast ? " show" : "") + (toast?.bad ? " bad" : "")} role="status" aria-live="polite">{toast?.text}</div>
      <ProgramHistory machine={m.name} />
    </>);
}
