import { useMemo, useState } from "react";
import HoldButton from "./HoldButton.jsx";
import ActionNote from "./ActionNote.jsx";
import { useSystemQuery, useSystemAction } from "./useSystem.js";
import { parseServices, countStates, filterServices, FILTERS, SERVICES_EVERY_MS } from "./system.js";
// The machine's own services (systemd on Linux, Windows services on This PC): failed ones on top, a filter, and Restart/Stop/Start that are held to confirm.
export default function SystemServices({ machine }) {
  const q = useSystemQuery(machine, "services", SERVICES_EVERY_MS), [filter, setFilter] = useState("all");
  const act = useSystemAction(machine, q.reload);
  const list = useMemo(() => parseServices(q.text), [q.text]), counts = countStates(list), shown = filterServices(list, filter);
  if (q.err && !q.text) return <div className="svcnote" role="alert">Could not read the services: {q.err}</div>;
  return (
    <div className="syssvc">
      <div className={"sysload" + (q.loading || act.busy ? " on" : "")} role="progressbar" aria-label="Loading" aria-hidden={!q.loading && !act.busy}><i /></div>
      <div className="sysfilter" role="group" aria-label="Show services">
        {FILTERS.map(([k, l]) => <button key={k} className={"fchip" + (filter === k ? " on" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k !== "all" && counts[k] ? ` · ${counts[k]}` : ""}</button>)}
        <button className="ghost" onClick={q.reload} disabled={q.loading}>Refresh</button>
      </div>
      <ActionNote note={act.note} onClose={act.clear} />
      {shown.map(s => <div className={"svcrow sysrow" + (s.state === "failed" ? " bad" : s.state === "active" ? " up" : "")} key={s.name}>
        <i /><b data-tip={s.name}>{s.desc && s.start ? s.desc : s.name}</b><span className="st">{s.state === "failed" ? "failed" : s.sub}</span><span className="sub" data-tip={s.desc}>{s.start ? `starts: ${s.start.toLowerCase()}` : s.desc}</span>
        <span className="cacts">{s.state === "active" ? <><HoldButton className="ghost" disabled={!!act.busy} onHold={() => act.run("restart", s.name)}>Restart</HoldButton><HoldButton className="ghost" disabled={!!act.busy} onHold={() => act.run("stop", s.name)}>Stop</HoldButton></>
          : <HoldButton className="ghost" disabled={!!act.busy} onHold={() => act.run("start", s.name)}>Start</HoldButton>}</span>
      </div>)}
      {!q.loading && !shown.length && <div className="quiet">No services to show here.</div>}
    </div>);
}
