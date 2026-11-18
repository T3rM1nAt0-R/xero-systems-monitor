import { useEffect, useMemo, useState } from "react";
import * as api from "../api.js";
import { ContainerLogs } from "../ContainerActions.jsx";
import { parseLog, searchLog, logTime, PRIORITIES, LOGS_EVERY_MS } from "../logs.js";
import { errorText } from "../system.js";
import { svcFacts } from "./meta.js";
// The Logs tab: the last 200 system log lines (journalctl on Linux, System and Application events on This PC) with a priority filter, a service filter (Linux), a search box and auto-refresh.
// Container logs open from the chips under the list.
export default function Logs({ m }) {
  const [priority, setPriority] = useState("errors"), [unit, setUnit] = useState(""), [find, setFind] = useState(""), [auto, setAuto] = useState(false);
  const [s, setS] = useState({ text: null, err: "", loading: true }), [tick, setTick] = useState(0), [box, setBox] = useState(null);
  const machine = m.name, windows = /^\s*[[{]/.test(s.text || "");
  useEffect(() => {
    let live = true;
    setS(p => ({ ...p, loading: true }));
    const u = unit.trim() || undefined, id = setTimeout(() => api.systemLogs(machine, priority, u).then(text => live && setS({ text, err: "", loading: false }), e => live && setS({ text: null, err: errorText(e), loading: false })), u ? 400 : 0);
    return () => { live = false; clearTimeout(id); };
  }, [machine, priority, unit, tick]);
  useEffect(() => { if (!auto) return undefined; const id = setInterval(() => setTick(n => n + 1), LOGS_EVERY_MS); return () => clearInterval(id); }, [auto]);
  const rows = useMemo(() => searchLog(parseLog(s.text), find), [s.text, find]), containers = svcFacts(m).cs;
  return (
    <div className="panel wide logs">
      <div className={"sysload" + (s.loading ? " on" : "")} role="progressbar" aria-label="Loading" aria-hidden={!s.loading}><i /></div>
      <div className="logbar">
        <div className="sysfilter" role="group" aria-label="Show log lines">
          {PRIORITIES.map(([k, l]) => <button key={k} className={"fchip" + (priority === k ? " on" : "")} aria-pressed={priority === k} onClick={() => setPriority(k)}>{l}</button>)}
        </div>
        {!windows && <input className="logfind" type="text" placeholder="Service, like ssh.service" aria-label="Only this service" value={unit} onChange={e => setUnit(e.target.value)} />}
        <input className="logfind" type="search" placeholder="Search these lines" aria-label="Search these lines" value={find} onChange={e => setFind(e.target.value)} />
        <label className="logauto"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Auto-refresh</label>
        <button className="ghost" onClick={() => setTick(n => n + 1)} disabled={s.loading}>Refresh</button>
      </div>
      {s.err && <div className="svcnote" role="alert">Could not read the log: {s.err}</div>}
      {!s.err && <div className="logrows" role="log" aria-label="System log">
        {rows.map((r, i) => <div className={"logrow" + (r.level ? " " + r.level : "")} key={i}><time>{logTime(r.t)}</time><b data-tip={r.unit}>{r.unit}</b><span>{r.msg}</span></div>)}
        {s.loading && !rows.length && <div className="skelrows" aria-busy="true" aria-label="Loading"><i /><i /><i /><i /><i /><i /></div>}
        {!s.loading && !rows.length && <div className="quiet">No log lines match.</div>}
      </div>}
      {containers.length > 0 && <div className="logcont"><span className="sub">Container logs:</span>{containers.map(c => <button key={c[0]} className="fchip" onClick={() => setBox(c[0])}>{c[0]}</button>)}</div>}
      {box && <ContainerLogs machine={machine} name={box} onClose={() => setBox(null)} />}
    </div>);
}
