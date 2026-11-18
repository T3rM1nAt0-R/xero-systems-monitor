import { useEffect, useState } from "react";
import Switch from "./Switch.jsx";
import * as api from "./api.js";
// The Hidden machines dialog: each hidden machine can be shown again, or paused (the collector stops polling it until you resume).
export default function HiddenMachines({ hidden, onShow, onClose }) {
  const [cfg, setCfg] = useState(null), [bad, setBad] = useState(""), [busy, setBusy] = useState("");
  useEffect(() => { api.getMachines().then(setCfg, () => {}); }, []);
  const find = n => cfg?.machines?.find(m => m.name === n);
  const pause = async (name, on) => {
    setBusy(name); setBad("");
    const machines = cfg.machines.map(m => (m.name === name ? { ...m, paused: on || undefined } : m)), r = await api.saveMachines(machines);
    setBusy("");
    if (r?.error) return setBad(r.error);
    setCfg({ ...cfg, machines });
    return true;
  };
  const again = async n => { if (find(n)?.paused && !(await pause(n, false))) return; onShow(n); };   // a paused machine would vanish entirely, so showing it resumes it
  return (
    <div className="modal" onClick={onClose}>
      <div className="dlg" role="dialog" aria-label="Hidden machines" onClick={e => e.stopPropagation()}>
        <h3>Hidden machines</h3>
        {!hidden.length && <div className="quiet">No machines are hidden. Use the ⋯ on a machine to hide one.</div>}
        {hidden.map(n => <div className="mrow hrow" key={n}>
          <b className="hname">{n}</b>
          {find(n) && <Switch on={!!find(n).paused} onChange={on => !busy && pause(n, on)}>{busy === n ? "Saving…" : "Pause monitoring"}</Switch>}
          <button onClick={() => again(n)}>Show again</button></div>)}
        {bad && <div className="quiet" role="alert" style={{ color: "var(--bad)" }}>{bad}</div>}
        <div className="quiet">Hidden machines leave the strip, the cards, the compact view and the tray summary. Pausing also stops checking the machine.</div>
        <div className="mfoot"><button className="cta" onClick={onClose}>Close</button></div>
      </div>
    </div>);
}
