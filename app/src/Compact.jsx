import { limitsFor } from "./limits.js";
import { isWarn, prOf, hm, hotMin, WATCH } from "./format.js";
import N from "./Pill.jsx";
// The compact view: one row per machine, one attention line on top. Click a row and its full card opens right under it.
export default function Compact({ limits, ms, now, lastOk, hot, expanded, onToggle, renderCard }) {
  const attn = ms.filter(m => m.err || hot[m.name]?.cpu || WATCH.some(k => isWarn(k, m.d?.[k], limitsFor(limits, m.name))));
  const first = attn[0];
  return (
    <div className="compact">
      {first && <div className="cattn"><b>▲ {first.name}</b> {first.err ? `offline${lastOk[first.name] ? " since " + hm(lastOk[first.name]) : ""}` : hot[first.name]?.cpu ? `CPU high for ${hotMin(hot[first.name].cpu, now)} min` : "needs a look"}{attn.length > 1 ? ` · +${attn.length - 1} more` : ""}</div>}
      {ms.map(m => { const d = m.d || {}, jobs = Object.entries(d.jobs || {}), total = Object.keys(d.runners || {}).length, lm = limitsFor(limits, m.name), bad = !m.err && (hot[m.name]?.cpu || WATCH.some(k => isWarn(k, d[k], lm))), open = expanded.has(m.name);
        return (
          <div className={"crow" + (open ? " open" : "")} key={m.name}>
            <button className="chead2" onClick={() => onToggle(m.name)} aria-expanded={open}>
              <i className={"dot" + (m.err ? " off" : bad ? " warn" : "")} /><b>{m.name}</b>
              {m.err ? <span className="cn off">Offline{lastOk[m.name] ? ` since ${hm(lastOk[m.name])}` : ""}</span>
                : <span className="cnums"><N label="CPU" v={d.cpu} u="%" warn={isWarn("cpu", d.cpu, lm)} /><N v={d.temp} u="°" warn={isWarn("temp", d.temp, lm)} /><N label="Mem" v={d.ram} u="%" warn={isWarn("ram", d.ram)} />{d.gpu != null && <N label="GPU" v={d.gpu} u="%" />}</span>}
              <em>{open ? "▾" : "▸"}</em>
            </button>
            {!m.err && total > 0 && jobs.length > 0 && <div className="cjobs"><i>●</i> {jobs.length} of {total} busy · {jobs.slice(0, 2).map(([, j]) => `${j[0] || "Job"} ${prOf(j[2])}`.trim()).join(", ")}{jobs.length > 2 ? ` +${jobs.length - 2}` : ""}</div>}
            {open && <div className="cbody">{renderCard(m)}</div>}
          </div>); })}
    </div>);
}
