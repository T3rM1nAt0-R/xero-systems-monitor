import { memo, useMemo } from "react";
import Chart from "./Chart.jsx";
import { metricVar } from "./colors.js";
import { pingRows } from "./network.js";
import { NONE } from "./consts.js";
// Ping map: This PC pings every other machine about every 30 seconds. A tile per machine (green, amber, red by delay, grey for no answer) and a latency graph.
const LINES = ["--c-ping", "--c-down", "--c-up", "--c-cpu", "--c-gpu", "--c-temp"];
const Lat = memo(function Lat({ names, h, t0, t1, span, live, group }) {
  const series = useMemo(() => names.map((n, i) => ({ name: n, pts: h?.extra?.["pm:" + n] || NONE, color: `var(${LINES[i % LINES.length]})` })), [names, h]);  
  return <div className="panel" style={{ "--c": metricVar("ping") }}><div className="ph"><h4>Latency</h4></div><Chart series={series} t0={t0} t1={t1} range={span} unit=" ms" group={group} title="Latency to machines" live={live} /></div>;
});
export default function PingMap({ m, d, h, t0, t1, span, live }) {
  const rows = pingRows(d), names = useMemo(() => (d.pings || []).map(p => p[0]), [d.pings]);
  if (!rows.length) return <div className="quiet">There are no other machines to ping.</div>;
  return (
    <div className="pingmap">
      <div className="ptiles">{rows.map(r => <div className={"ptile " + r.cls} key={r.name}><b>{r.name}</b><span>{r.text}</span></div>)}</div>
      <Lat names={names} h={h} t0={t0} t1={t1} span={span} live={live} group={m.name} />
    </div>);
}
