import { useEffect, useState } from "react";
import Chart from "./Chart.jsx";
import { saveCsv, savePng } from "./graphExport.js";
import { shade } from "./graphTools.js";
import { setZoom, useAllHistory } from "./graphView.js";
// The small things around a graph card: save buttons, the reset-zoom chip, and the full-window graph.
export function SaveButtons({ title, series, card }) {
  const [err, setErr] = useState(false);
  const png = () => savePng(title, card.current.querySelector(".chart")).then(() => setErr(false), () => setErr(true));
  return <span className="gsave"><button onClick={png} data-tip="Save picture (PNG)" aria-label={`Save ${title} as a picture`}>Picture</button><button onClick={() => saveCsv(title, series)} data-tip="Save the numbers (CSV, opens in a spreadsheet)" aria-label={`Save ${title} data as CSV`}>CSV</button>{err && <em role="alert">Could not save</em>}</span>;
}
export const ZoomChip = ({ machine, span }) => span && <button className="zchip" onClick={() => setZoom(machine, null)} data-tip="Show the full time range again (or double-click a graph)">× Reset zoom</button>;

// One metric big, with checkboxes to lay the same metric from the other machines over it. Esc or a click outside closes it.
export function FullGraph({ title, k, color, machine, pts, onClose, ...chart }) {
  const all = useAllHistory(), others = Object.keys(all).filter(n => n !== machine && all[n]?.[k]?.length);
  const [on, setOn] = useState(() => new Set());
  useEffect(() => { const f = e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }; window.addEventListener("keydown", f, true); return () => window.removeEventListener("keydown", f, true); }, [onClose]);
  const names = [machine, ...others], shown = [machine, ...others.filter(n => on.has(n))];
  const series = shown.map(n => ({ name: n, pts: n === machine ? pts : all[n][k], color: shade(color, names.indexOf(n)) }));
  const flip = n => setOn(s => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  return (
    <div className="modal" onClick={onClose}><div className="dlg fullgraph" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="fghead"><h3>{title} · {machine}</h3><button onClick={onClose} aria-label="Close">Close (Esc)</button></div>
      <Chart {...chart} series={series} group={"full:" + machine + k} title={title} zoomable={false} />
      <div className="legend">{names.map(n => <label key={n} style={{ "--c": shade(color, names.indexOf(n)) }}><input type="checkbox" checked={n === machine || on.has(n)} disabled={n === machine} onChange={() => flip(n)} /><i />{n}</label>)}
        {!others.length && <span className="quiet">No other machines to compare.</span>}</div>
    </div></div>);
}
