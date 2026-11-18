import { useEffect, useState } from "react";
import Sub from "./Sub.jsx";
import { getBusiest } from "./api.js";
import { RANGES, rankRows, memText, cpuText } from "./procs.js";
// "What was busy": the programs that used the most CPU or memory over the last hour, 6 hours or 24 hours, as a ranked list with small bars.
// It reads the per-minute history, so a range only has data from when the app started saving it.
export default function ProgramHistory({ machine }) {
  const [range, setRange] = useState(RANGES[0][1]), [by, setBy] = useState("cpu"), [ans, setAns] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => getBusiest(machine, range).then(a => live && setAns(a), () => live && setAns({ minutes: 0, top: [] }));
    setAns(null); load();
    const t = setInterval(load, 60000);   // history moves one minute at a time
    return () => { live = false; clearInterval(t); };
  }, [machine, range]);
  const rows = rankRows(ans, by), have = ans?.minutes || 0, want = range / 60;
  return (
    <Sub id={machine + ".busyhist"} title="What was busy" hint={ans && have ? `${have} of ${want} minutes saved` : ""}>
      <div className="histbar">
        <span className="seg" role="group" aria-label="Time range">{RANGES.map(([label, s]) => <button key={s} type="button" className={range === s ? "on" : ""} aria-pressed={range === s} onClick={() => setRange(s)}>{label}</button>)}</span>
        <span className="seg" role="group" aria-label="Rank by">{[["cpu", "Most CPU"], ["ram", "Most memory"]].map(([k, label]) => <button key={k} type="button" className={by === k ? "on" : ""} aria-pressed={by === k} onClick={() => setBy(k)}>{label}</button>)}</span>
      </div>
      {!ans ? <div className="skelrows" aria-busy="true" aria-label="Loading"><i /><i /><i /><i /></div>
        : rows.length === 0 ? <p className="quiet">Nothing was saved for this time yet. One list is saved every minute while the app runs.</p>
        : <div className="procs">{rows.map(r => (
          <div className="prow histrow" key={r.name}>
            <b data-tip={r.name}>{r.name}</b>
            <span className="meter"><i style={{ width: r.share + "%" }} /></span>
            <span>{by === "ram" ? memText(r.mb) : cpuText(r.cpu)}</span>
            <span data-tip="Minutes it was among the busiest">{r.minutes} min</span>
          </div>))}</div>}
    </Sub>);
}
