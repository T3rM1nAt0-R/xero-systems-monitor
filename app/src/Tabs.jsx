import { useLayoutEffect, useRef } from "react";
import { stepTab } from "./sections/tabs.js";
// The tab row of a machine card. An accessible tablist: arrow keys (and Home / End) move between tabs while the row has focus.
export const tabId = (base, id) => `${base}-tab-${id}`;
export const panelId = base => `${base}-panel`;
export default function Tabs({ tabs, tab, onTab, base, badges = {} }) {
  const refs = useRef({}), bar = useRef(null), seen = useRef({}), sig = JSON.stringify(badges);
  useLayoutEffect(() => {   // the underline slides to the open tab (transform and width, only when the tab or the badges change)
    const el = refs.current[tab], b = bar.current; if (!el || !b) return undefined;
    b.style.width = el.offsetWidth + "px"; b.style.transform = `translateX(${el.offsetLeft}px)`;
    const r = requestAnimationFrame(() => b.classList.add("ready"));
    return () => cancelAnimationFrame(r);
  }, [tab, tabs.length, sig]);
  const pops = {}; for (const [id] of tabs) pops[id] = seen.current[id] != null && (badges[id] || 0) > seen.current[id];
  useLayoutEffect(() => { seen.current = { ...badges }; }, [sig]);   // eslint-disable-line react-hooks/exhaustive-deps -- `sig` stands for `badges`
  const onKey = e => {
    const next = stepTab(tabs, tab, e.key);
    if (next === tab && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault(); onTab(next); refs.current[next]?.focus();
  };
  return (
    <div className="tabs" data-look="layout.tabs" role="tablist" aria-label="Views" onKeyDown={onKey}>
      {tabs.map(([id, title]) => <button key={id} ref={el => { refs.current[id] = el; }} role="tab" id={tabId(base, id)} aria-selected={id === tab} aria-controls={panelId(base)} tabIndex={id === tab ? 0 : -1} className={id === tab ? "on" : ""} onClick={() => onTab(id)}>{title}{badges[id] > 0 && <span key={badges[id]} className={"tbadge" + (pops[id] ? " pop" : "")}>{badges[id]}</span>}</button>)}
      <i className="tabbar" ref={bar} aria-hidden="true" />
    </div>);
}
