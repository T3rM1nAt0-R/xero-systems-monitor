import { useState } from "react";
import useBigFolders from "./useBigFolders.js";
import { scanView } from "./disks.js";
// "Find biggest folders": on demand, for a drive or path you choose. It only reads (nothing is ever deleted) and can be stopped.
export default function BigFolders({ machine, drives }) {
  const [path, setPath] = useState(drives[0] || "/"), { reply, start, cancel } = useBigFolders(machine), v = scanView(reply), busy = v.phase === "running";
  const go = e => { e.preventDefault(); if (!busy && path.trim()) start(path.trim()); };
  return (
    <div className="bigf">
      <form className="bigf-form" onSubmit={go}>
        <input value={path} onChange={e => setPath(e.target.value)} list={"bf-" + machine} aria-label="Drive or folder to look in" placeholder="A drive or folder, like / or D:\" spellCheck={false} />
        <datalist id={"bf-" + machine}>{drives.map(n => <option key={n} value={n} />)}</datalist>
        {busy ? <button type="button" onClick={cancel}>Stop</button> : <button type="submit" disabled={!path.trim()}>Find biggest folders</button>}
      </form>
      <small className="quiet">It only looks and adds up sizes. Nothing is deleted or changed.</small>
      {busy && <div className="scanbar" role="progressbar" aria-label="Looking for the biggest folders"><i /><span>Looking… {v.seen.toLocaleString("en-US")} files so far</span></div>}
      {v.phase === "failed" && <div className="bigf-note bad" role="alert">{v.error}</div>}
      {v.phase === "cancelled" && <div className="bigf-note">Stopped.</div>}
      {v.phase === "done" && <ol className="bigf-list">{v.rows.map(r => <li key={r.path}><span data-tip={r.path}>{r.path}</span><span className="meter"><i style={{ width: r.pct + "%" }} /></span><em>{r.size}</em></li>)}</ol>}
    </div>);
}
