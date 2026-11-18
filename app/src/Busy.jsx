import { useMemo } from "react";
import Sub from "./Sub.jsx";
import { busyHeat, heatTip, dayLine, hour12, HEAT_AXIS } from "./busy.js";
// "Busy this week": a heatmap, one row per day (today last) and one cell per hour. A darker cell means more of the runners' time was busy.
export default function Busy({ rows, machine, count, running, now }) {
  const runs = running.length, slot = Math.floor(now / 300);   // the heatmap only moves every 5 minutes
  const days = useMemo(() => busyHeat(rows, machine, count, running, now, 7), [rows, machine, count, runs, slot]);   // eslint-disable-line react-hooks/exhaustive-deps -- `running` and `now` are read through their narrowed forms `runs` and `slot`
  if (!count) return null;
  return (
    <Sub id={machine + ".busy"} title="Busy this week"><div className="heat">
      <div className="hgrid">
        {days.map(d => <div className="hrow" key={d.date}><span className="hd">{d.today ? "Today" : d.day}</span>
          <div className="hcells">{d.cells.map(c => <i key={c.h} className={c.pct == null ? "future" : c.failed ? "fail" : ""} style={c.pct == null ? undefined : { "--p": Math.round(c.pct) }} data-tip={heatTip(d, c)} />)}</div></div>)}
        <div className="hrow axis"><span className="hd" /><div className="hcells">{Array.from({ length: 24 }, (_, h) => <b key={h}>{HEAT_AXIS.includes(h) ? hour12(h) : ""}</b>)}</div></div>
      </div>
      <div className="hdays">{days.map(d => <div key={d.date}><b>{d.today ? "Today" : d.day}</b><span className={d.failed ? "bad" : "dim"}>{dayLine(d)}</span></div>)}</div>
    </div></Sub>);
}
