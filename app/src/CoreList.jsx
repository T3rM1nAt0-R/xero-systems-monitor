import Sub from "./Sub.jsx";
import { coreRows } from "./hwStrip.js";
// Every CPU core on its own line: how busy it is (a bar and a number) and how warm it is. Shows only what the machine reports.
export default function CoreList({ d, id }) {
  const rows = coreRows(d);
  if (!rows.length) return null;
  return (
    <Sub id={id} title="Each core" hint={`${rows.length} cores`}>
      <div className="corelist">
        {rows.map(r => (
          <div className="corerow" key={r.n}>
            <b>Core {r.n}</b>
            <span className={"meter" + (r.load >= 90 ? " warn" : "")}><i style={{ width: Math.min(100, r.load ?? 0) + "%" }} /></span>
            <span>{r.load != null ? r.load.toFixed(0) + "%" : "–"}</span>
            <span>{r.temp != null ? r.temp.toFixed(0) + "°C" : "–"}</span>
          </div>))}
      </div>
    </Sub>);
}
