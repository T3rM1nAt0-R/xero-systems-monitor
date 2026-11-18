import Smooth from "../Smooth.jsx";
import RunnersTable from "../RunnersTable.jsx";
import Queue from "../Queue.jsx";
import Trends from "../Trends.jsx";
import Busy from "../Busy.jsx";
import RunnerStats from "../RunnerStats.jsx";
import JobHistory from "../JobHistory.jsx";
import { FULL } from "./tabs.js";
// The Runners section: one table with a row and a timeline lane per runner. Compact view (Overview): just the compact table. Full view (Runners tab): the 3 big numbers, the queue, 7-day trends, the busy heatmap and the job history.
export default function Runners({ m, d, rows, gone, t1, view }) {
  return (
    <Smooth className="panel wide">
      {view === FULL && <RunnerStats rows={rows} machine={m.name} now={t1} />}
      <RunnersTable machine={m.name} d={d} started={m.started} gone={gone} now={t1} finished={rows} compact={view !== FULL} />
      {view === FULL && <>
        <Queue machine={m.name} d={d} now={t1} />
        <Trends rows={rows} machine={m.name} now={t1} />
        <Busy rows={rows} machine={m.name} count={Object.keys(d.runners).length} running={Object.values(m.started || {})} now={t1} />
        <JobHistory rows={rows} machine={m.name} />
      </>}
    </Smooth>);
}
