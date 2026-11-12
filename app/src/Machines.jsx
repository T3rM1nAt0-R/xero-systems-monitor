import Switch from "./Switch.jsx";
import { useEffect, useState } from "react";
import * as api from "./api.js";
export default function Machines({ onClose }) {
  const [cfg, setCfg] = useState(null), [name, setName] = useState(""), [host, setHost] = useState(""), [runner, setRunner] = useState(false), [saving, setSaving] = useState(false), [bad, setBad] = useState("");
  useEffect(() => { api.getMachines().then(setCfg); }, []);
  if (!cfg) return null;
  const rm = m => setCfg({ ...cfg, machines: cfg.machines.filter(x => x !== m) });
  const move = (i, d) => { const a = [...cfg.machines], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setCfg({ ...cfg, machines: a }); };   // the window shows machines in this order
  const rename = (i, v) => { const a = [...cfg.machines], m = a[i], was = m.was || m.name; a[i] = { ...m, name: v, was: was === v ? undefined : was }; setCfg({ ...cfg, machines: a }); };   // "was" lets the collector move the history to the new name
  const add = () => { if (name.trim() && host.trim()) { setCfg({ ...cfg, machines: [...cfg.machines, { name: name.trim(), kind: "ssh", host: host.trim(), runner }] }); setName(""); setHost(""); setRunner(false); } };
  const save = async () => { setSaving(true); const r = await api.saveMachines(cfg.machines); if (r?.error) { setBad(r.error); setSaving(false); } else onClose(); };
  return (
    <div className="modal" onClick={onClose}>
      <div className="dlg" onClick={e => e.stopPropagation()}>
        <h3>Machines</h3>
        {cfg.machines.map((m, i) => <div className="mrow" key={i}>
          <span className="mmove"><button className="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${m.name} up`}>▲</button><button className="ghost" disabled={i === cfg.machines.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${m.name} down`}>▼</button></span>
          <input className="mname" value={m.name} onChange={e => rename(i, e.target.value)} aria-label="Machine name" data-tip="Rename (its history comes along)" />
          <span>{m.kind === "local" ? "this PC" : m.host + (m.runner ? " · runners" : "")}</span><button className="danger" onClick={() => rm(m)}>Remove</button></div>)}
        {bad && <div className="quiet" role="alert" style={{ color: "var(--bad, #fb5a72)" }}>{bad}</div>}
        <div className="madd">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="SSH alias or user@ip" value={host} onChange={e => setHost(e.target.value)} />
          <Switch on={runner} onChange={setRunner}>GitHub runners</Switch>
          <button onClick={add}>Add</button>
        </div>
        <div className="mfoot"><button onClick={onClose}>Cancel</button><button className="cta" disabled={saving} onClick={save}>{saving ? "Restarting…" : "Save and restart"}</button></div>
      </div>
    </div>
  );
}
