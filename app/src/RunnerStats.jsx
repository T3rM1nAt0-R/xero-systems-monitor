import { useMemo } from "react";
import { runnerStats, successTone } from "./runnerStats.js";
import { dur } from "./format.js";
// Three big numbers: jobs today, how many succeeded, and the typical (median) time a job took. The percent is green from 90, amber from 75, red below.
export default function RunnerStats({ rows, machine, now }) {
  const slot = Math.floor(now / 60), s = useMemo(() => runnerStats(rows, machine, Math.floor(now)), [rows, machine, slot]);   // eslint-disable-line react-hooks/exhaustive-deps -- `now` is read through its narrowed form `slot`
  return (
    <div className="rstats">
      <div><span className="lbl">Jobs today</span><b>{s.jobs}</b></div>
      <div><span className="lbl">Succeeded</span><b className={successTone(s.success)}>{s.success == null ? "–" : <>{s.success}<small>%</small></>}</b></div>
      <div><span className="lbl">Median time</span><b>{s.median == null ? "–" : dur(s.median)}</b></div>
    </div>);
}
