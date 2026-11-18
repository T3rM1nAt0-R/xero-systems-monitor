import { memo, useMemo } from "react";
import Chart from "./Chart.jsx";
import { metricVar } from "./colors.js";
import { rateStr } from "./format.js";
import { ioDrives, ioNow, ioPts } from "./disks.js";
// Read and write speed of each drive over time (the same range and hover as the other graphs).
const Io = memo(function Io({ name, read, write, now, t0, t1, span, live, group }) {
  const series = useMemo(() => [{ name: "Read", pts: read, color: metricVar("down") }, { name: "Write", pts: write, color: metricVar("up") }], [read, write]);
  return (
    <div className="panel" style={{ "--c": metricVar("disk") }}>
      <div className="ph"><h4>{name}</h4>{now && <span className="sum">Read {rateStr(now[0])} · Write {rateStr(now[1])}</span>}</div>
      <Chart series={series} t0={t0} t1={t1} range={span} fmt={rateStr} group={group} title={name + " speed"} live={live} />
    </div>);
});
export default function DiskIo({ m, d, h, t0, t1, span, live }) {
  const names = ioDrives(d, h);
  if (!names.length) return <div className="quiet">Drive speed will show here after a few readings.</div>;
  return <div className="dgrid">{names.map(n => <Io key={n} name={n} read={ioPts(h, "dr", n)} write={ioPts(h, "dw", n)} now={ioNow(d, n)} t0={t0} t1={t1} span={span} live={live} group={m.name} />)}</div>;
}
