import { useMemo } from "react";
import { busyByDay } from "./busy.js";
// Seven small columns: how busy this machine's runners were each day (all runners together).
export default function Busy({ rows, machine, count, running, now }) {
  const days = useMemo(() => busyByDay(rows, machine, count, running, now, 7), [rows, machine, count, running.length, Math.floor(now / 300)]);
  if (!count) return null;
  return (
    <div className="bpd"><span className="lbl">Busy per day</span>
      {days.map(d => <div key={d.date} className="bcol" data-tip={`${d.day}, ${d.date}\n${d.pct.toFixed(0)}% of runner time busy${d.today ? " so far today" : ""}`}><i style={{ height: Math.max(2, d.pct) + "%" }} /><b>{d.day.slice(0, 2)}</b></div>)}
    </div>);
}
