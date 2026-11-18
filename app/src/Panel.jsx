import { useState, useCallback, memo, useMemo, useRef } from "react";
import BusyPopover from "./BusyPopover.jsx";
import { SaveButtons, FullGraph } from "./GraphTools.jsx";
import { shiftSeries } from "./graphTools.js";
import { useCompare } from "./graphView.js";
import Chart from "./Chart.jsx";
import { metricVar } from "./colors.js";
import Roll from "./Roll.jsx";
// One graph card. Module-level and memoised so charts keep their state between polls.
// Every prop is a number, a string, or an object that keeps its identity between polls, so memo can skip a graph whose numbers did not change.
// `val` is the big number and `vu` the small unit after it; `fcText` (with `fcWarn`, `fcTip`) is the disk forecast chip; `children` go under the graph.
const Panel = memo(function Panel({ title, val, vu, warn, sm, fcText, fcWarn, fcTip, cls = "", k, name, pts, max, unit, fmt, thr, thrLabel, mk, usual, t0, t1, range, group, old, live, busy, loading, children }) {
  const series = useMemo(() => [{ name: name || title, pts, color: metricVar(k) }], [name, title, pts, k]);
  const card = useRef(null), [big, setBig] = useState(false), off = useCompare();
  const [pop, setPop] = useState(null), shut = useCallback(() => setPop(null), []), pick = useCallback((t, x, y) => setPop({ t, x, y }), []);
  const cmp = useMemo(() => (off && old ? shiftSeries(old, off, t0, t1) : null), [off, old, t0, t1]);   // yesterday / last week, moved onto today's clock
  return (
    <div className={"panel " + cls + (loading ? " skel" : "")} style={{ "--c": metricVar(k) }} ref={card}>
      <div className="ph"><h4><button className="ttl" onClick={() => setBig(true)} data-tip="Open this graph full window">{title}</button></h4><SaveButtons title={title} series={series} card={card} />{val != null && <span className={"now" + (warn ? " warn" : "")}><Roll value={val} />{vu && <small>{vu}</small>}</span>}{usual != null && <span className="unusual" data-tip="Higher than this machine usually runs at this time of day (compared with the same hour over the last 7 days)">Unusual for this time · normally ~{usual}{unit?.trim()}</span>}{sm && <span className="sum">{sm}</span>}{fcText && <span className={"sum fc" + (fcWarn ? " warn" : "")} data-tip={fcTip}>{fcText}</span>}</div>
      <Chart series={series} t0={t0} t1={t1} max={max} unit={unit} fmt={fmt} thr={thr} thrLabel={thrLabel} range={range} marks={mk} group={group} title={title} cmp={cmp} cmpLabel={off === 86400 ? "yesterday" : "last week"} live={live} onPick={busy ? pick : undefined} />
      {children}
      {pop && <BusyPopover machine={group} {...pop} range={range} onClose={shut} />}
      {big && <FullGraph title={title} k={k} machine={group} pts={pts} t0={t0} t1={t1} max={max} unit={unit} fmt={fmt} thr={thr} thrLabel={thrLabel} range={range} marks={mk} live={live} onClose={() => setBig(false)} />}
    </div>);
});
export default Panel;
