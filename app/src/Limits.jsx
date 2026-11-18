import { useState } from "react";
import { LIMIT_FIELDS, DEFAULT_LIMITS, limitsFor, setLimit } from "./limits.js";
// "Limits…": when each machine counts as "needs a look". Numbers left empty (or out of range) fall back to the standard limit.
export default function Limits({ names, limits, onSave, onClose }) {
  const [all, setAll] = useState(limits);
  const val = (n, k) => { const v = all[n]?.[k]; return v === undefined ? DEFAULT_LIMITS[k] : v; };
  const same = k => names.length && names.every(n => String(limitsFor(all, n)[k]) === String(limitsFor(all, names[0])[k])) ? limitsFor(all, names[0])[k] : "";
  const cell = (n, k, v, label) => { const f = LIMIT_FIELDS.find(x => x[0] === k);
    return <input key={k} type="number" inputMode="numeric" min={f[3]} max={f[4]} value={v} aria-label={`${label}: ${f[1]} (${f[2]})`} onChange={e => setAll(a => setLimit(a, names, n, k, e.target.value))} />; };
  return (
    <div className="modal" onClick={onClose}>
      <div className="dlg limdlg" onClick={e => e.stopPropagation()}>
        <h3>Limits</h3>
        <div className="quiet">Colours, red lines on the graphs and alerts use these. Standard: CPU {DEFAULT_LIMITS.cpu}%, temperatures {DEFAULT_LIMITS.temp}°C, disk {DEFAULT_LIMITS.disk}% or full in {DEFAULT_LIMITS.days} days.</div>
        <div className="limgrid" role="group" aria-label="Limits per machine">
          <span />{LIMIT_FIELDS.map(([k, l, u]) => <small key={k}>{l} ({u})</small>)}
          <b>Same for all</b>{LIMIT_FIELDS.map(([k]) => cell(null, k, same(k), "Same for all"))}
          {names.map(n => [<b key={n} data-tip={n}>{n}</b>, ...LIMIT_FIELDS.map(([k]) => cell(n, k, val(n, k), n))])}
        </div>
        <div className="mfoot"><button onClick={() => setAll({})}>Back to standard</button><span className="grow" /><button onClick={onClose}>Cancel</button><button className="cta" onClick={() => onSave(all)}>Save</button></div>
      </div>
    </div>
  );
}
