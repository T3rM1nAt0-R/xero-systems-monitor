import { useState } from "react";
import { groupLabel, moveGroup, toggleHidden } from "./order.js";
// The small "Groups…" option on a machine card: hide groups you never use, and move the rest up or down.
export default function GroupsMenu({ name, g, set, avail }) {
  const [open, setOpen] = useState(false);
  const rows = g.order.filter(k => avail.includes(k));
  return (
    <span className="gmenu" onClick={e => e.stopPropagation()}>
      <button className="ghost" onClick={() => setOpen(o => !o)} aria-expanded={open} data-tip="Hide or reorder this machine's groups">Groups…</button>
      {open && <div className="gpop" role="group" aria-label={`Groups on ${name}`}>
        {rows.map((k, i) => <div className="grow2" key={k}>
          <label><input type="checkbox" checked={!g.hidden.includes(k)} onChange={() => set(toggleHidden(g, k))} />{groupLabel(k)}</label>
          <button className="ghost" disabled={i === 0} onClick={() => set(moveGroup(g, k, g.order.indexOf(rows[i - 1]) - g.order.indexOf(k)))} aria-label="Move up">▲</button>
          <button className="ghost" disabled={i === rows.length - 1} onClick={() => set(moveGroup(g, k, g.order.indexOf(rows[i + 1]) - g.order.indexOf(k)))} aria-label="Move down">▼</button>
        </div>)}
        <button onClick={() => setOpen(false)}>Done</button>
      </div>}
    </span>);
}
