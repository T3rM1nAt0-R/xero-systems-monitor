import { Fragment, useMemo, useState } from "react";
import { eventKind, FILTERS } from "./events.js";
import { hm } from "./format.js";
const dayName = t => { const d = new Date(t * 1000), n = new Date(), y = new Date(n - 86400000); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, n) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
// The Activity list as a drawer above the footer: the graphs stay visible above it.
export default function ActivityDrawer({ events, onClose }) {
  const [f, setF] = useState("all");
  const counts = useMemo(() => { const c = { all: events.length, fail: 0, job: 0, machine: 0, alert: 0 }; for (const e of events) c[eventKind(e[2], e[1]).kind]++; return c; }, [events]);
  const shown = useMemo(() => events.filter(e => f === "all" || eventKind(e[2], e[1]).kind === f).slice(0, 80), [events, f]);
  let last = "";
  return (
    <div className="drawer" role="region" aria-label="Activity">
      <div className="dh"><b>Activity</b>
        <div className="seg" role="group" aria-label="Filter">{FILTERS.map(([k, l]) => <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}{k !== "all" && counts[k] ? ` · ${counts[k]}` : ""}</button>)}</div>
        <span className="grow" /><button className="ghost" onClick={onClose} data-tip="Close (Esc)">Close ▾</button></div>
      <div className="dbody">
        {shown.map((e, i) => { const day = dayName(e[0]), head = day !== last; last = day; const k = eventKind(e[2], e[1]);
          return <Fragment key={i}>{head && <div className="dday">{day}</div>}
            <div className="dev"><time>{hm(e[0])}</time><u className={k.tone} /><span><b>{e[1]}</b> {e[2]}</span></div></Fragment>; })}
        {!shown.length && <div className="quiet dempty">{events.length ? "Nothing in this filter." : "Nothing has happened in the last day."}</div>}
      </div>
    </div>);
}
