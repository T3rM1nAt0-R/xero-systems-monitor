import Smooth from "../Smooth.jsx";
import Jobs from "../Jobs.jsx";
import RunnerList from "../RunnerList.jsx";
import TimelineSection from "../TimelineSection.jsx";
import Trends from "../Trends.jsx";
import Busy from "../Busy.jsx";
import RunnerStats from "../RunnerStats.jsx";
import JobHistory from "../JobHistory.jsx";
import { FULL } from "./tabs.js";
// The Runners section. Compact view (Overview): chips, running jobs and the timeline. Full view (Runners tab): also 7-day trends, the busy heatmap and the job history.
export default function Runners({ m, d, rows, gone, t1, view }) {
  return (
    <Smooth className="panel wide">
      {view === FULL && <RunnerStats rows={rows} machine={m.name} now={t1} />}
      {view === FULL ? <RunnerList machine={m.name} d={d} started={m.started} gone={gone} now={t1} finished={rows} /> : <Jobs d={d} now={t1} started={m.started} gone={gone} />}
      <TimelineSection machine={m.name} rows={rows} runners={d.runners} jobs={d.jobs} started={m.started} t1={t1} />
      {view === FULL && <>
        <Trends rows={rows} machine={m.name} now={t1} />
        <Busy rows={rows} machine={m.name} count={Object.keys(d.runners).length} running={Object.values(m.started || {})} now={t1} />
        <JobHistory rows={rows} machine={m.name} />
      </>}
    </Smooth>);
}
