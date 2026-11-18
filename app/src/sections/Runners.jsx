import Smooth from "../Smooth.jsx";
import Jobs from "../Jobs.jsx";
import Sub from "../Sub.jsx";
import Timeline from "../Timeline.jsx";
import Trends from "../Trends.jsx";
import Busy from "../Busy.jsx";
import JobHistory from "../JobHistory.jsx";
import { FULL } from "./tabs.js";
// The Runners section. Compact view (Overview): chips, running jobs and the timeline. Full view (Runners tab): also 7-day trends, the busy heatmap and the job history.
export default function Runners({ m, d, rows, gone, t0, t1, range, view }) {
  return (
    <Smooth className="panel wide">
      <Jobs d={d} now={t1} started={m.started} gone={gone} />
      <Sub id={m.name + ".tl"} title="Timeline"><Timeline machine={m.name} rows={rows} runners={d.runners} jobs={d.jobs} started={m.started} t0={t0} t1={t1} range={range} /></Sub>
      {view === FULL && <>
        <Trends rows={rows} machine={m.name} now={t1} />
        <Busy rows={rows} machine={m.name} count={Object.keys(d.runners).length} running={Object.values(m.started || {})} now={t1} />
        <JobHistory rows={rows} machine={m.name} />
      </>}
    </Smooth>);
}
