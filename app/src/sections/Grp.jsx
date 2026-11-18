import { useContext, useEffect, useRef } from "react";
import { GroupLayout, onReveal } from "../groupPrefs.js";
import { useFold, foldProps } from "../fold.js";
import Spark from "../Spark.jsx";
import Collapse from "../Collapse.jsx";
// A section with a clickable label. The open/closed choice is remembered per machine. Folded, it shows a summary and a tiny line of its first graph.
// It takes this machine's chosen section order and hidden sections from the GroupLayout context, and opens itself when asked (revealGroup).
export default function Grp({ id, color, title, sub, summary, spark, def = true, cls = "", pinned, onPin, children }) {
  const [open, flip, set] = useFold(id, def);
  const lay = useContext(GroupLayout), gk = id.slice(id.lastIndexOf(".") + 1);
  const setOpen = useRef(set); setOpen.current = set;   // `set` is a new function each render; the reveal listener must call the latest one
  useEffect(() => onReveal(w => { if (w === id) { setOpen.current(true); setTimeout(() => document.getElementById("g-" + id)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60); } }), [id]);
  if (lay?.hidden.includes(gk)) return null;
  return (
    <section id={"g-" + id} className={"grp " + cls + (open ? "" : " shut")} style={{ "--g": color, order: lay ? lay.order.indexOf(gk) : undefined }}>
      <h5 data-look="text.section" {...foldProps(open, flip)}>
        <b className="chev">{open ? "▾" : "▸"}</b>{title}{sub && <span>{sub}</span>}{!open && summary && <em>{summary}</em>}{!open && spark && <Spark pts={spark} color={color} />}{onPin && <button className={"pin" + (pinned ? " on" : "")} aria-pressed={!!pinned} aria-label={(pinned ? "Unpin " : "Pin ") + title + (pinned ? " from Overview" : " to Overview")} data-tip={pinned ? "Pinned to Overview. Click to unpin." : "Pin the whole section to Overview"} onClick={e => { e.stopPropagation(); onPin(); }} onKeyDown={e => e.stopPropagation()}><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 1.5l4.5 4.5-1.8.6-2.6 2.6.3 3.3-1 1L6.7 10l-4.2 4.2-.7-.7L6 9.3 2.7 5.9l1-1 3.3.3 2.6-2.6z" fill="currentColor" /></svg></button>}
      </h5>
      <Collapse open={open}>{children}</Collapse>
    </section>);
}
