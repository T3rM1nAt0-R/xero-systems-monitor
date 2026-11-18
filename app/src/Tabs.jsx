import { useRef } from "react";
import { stepTab } from "./sections/tabs.js";
// The tab row of a machine card. An accessible tablist: arrow keys (and Home / End) move between tabs while the row has focus.
export const tabId = (base, id) => `${base}-tab-${id}`;
export const panelId = base => `${base}-panel`;
export default function Tabs({ tabs, tab, onTab, base }) {
  const refs = useRef({});
  const onKey = e => {
    const next = stepTab(tabs, tab, e.key);
    if (next === tab && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault(); onTab(next); refs.current[next]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label="Views" onKeyDown={onKey}>
      {tabs.map(([id, title]) => <button key={id} ref={el => { refs.current[id] = el; }} role="tab" id={tabId(base, id)} aria-selected={id === tab} aria-controls={panelId(base)} tabIndex={id === tab ? 0 : -1} className={id === tab ? "on" : ""} onClick={() => onTab(id)}>{title}</button>)}
    </div>);
}
