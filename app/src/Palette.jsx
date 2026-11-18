import { useEffect, useMemo, useRef, useState } from "react";
import { filterItems } from "./search.js";
// Ctrl+K: type to filter, arrow keys to choose, Enter to do it, Esc to close. `items` come from buildCommands().
export default function Palette({ items, onClose }) {
  const [q, setQ] = useState(""), [sel, setSel] = useState(0), list = useRef(null);
  const shown = useMemo(() => filterItems(items, q), [items, q]);
  useEffect(() => { list.current?.children[sel]?.scrollIntoView({ block: "nearest" }); }, [sel, shown]);
  const run = it => { onClose(); it?.run(); };
  const key = e => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(shown.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(shown[sel]); }
  };
  return (
    <div className="modal pal" onClick={onClose}>
      <div className="dlg" role="dialog" aria-label="Search" onClick={e => e.stopPropagation()}>
        <input autoFocus value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={key} placeholder="Type to search: a machine, a setting, a time range…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="pal-list" />
        <div className="plist" id="pal-list" role="listbox" ref={list}>
          {shown.map((it, i) => <div key={it.id} role="option" aria-selected={i === sel} className={"popt" + (i === sel ? " sel" : "")} onMouseMove={() => setSel(i)} onClick={() => run(it)}><span>{it.label}</span><em>{it.section}</em></div>)}
          {!shown.length && <div className="quiet">Nothing matches &ldquo;{q}&rdquo;.</div>}
        </div>
      </div>
    </div>);
}
