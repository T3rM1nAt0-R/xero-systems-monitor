import { useContext, useEffect, useRef } from "react";
import { GroupLayout, onReveal } from "../groupPrefs.js";
import { useFold, foldProps } from "../fold.js";
import Spark from "../Spark.jsx";
// A section with a clickable label. The open/closed choice is remembered per machine. Folded, it shows a summary and a tiny line of its first graph.
// It takes this machine's chosen section order and hidden sections from the GroupLayout context, and opens itself when asked (revealGroup).
export default function Grp({ id, color, title, sub, summary, spark, def = true, cls = "", children }) {
  const [open, flip, set] = useFold(id, def);
  const lay = useContext(GroupLayout), gk = id.slice(id.lastIndexOf(".") + 1);
  const setOpen = useRef(set); setOpen.current = set;   // `set` is a new function each render; the reveal listener must call the latest one
  useEffect(() => onReveal(w => { if (w === id) { setOpen.current(true); setTimeout(() => document.getElementById("g-" + id)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60); } }), [id]);
  if (lay?.hidden.includes(gk)) return null;
  return (
    <section id={"g-" + id} className={"grp " + cls + (open ? "" : " shut")} style={{ "--g": color, order: lay ? lay.order.indexOf(gk) : undefined }}>
      <h5 {...foldProps(open, flip)}>
        <b className="chev">{open ? "▾" : "▸"}</b>{title}{sub && <span>{sub}</span>}{!open && summary && <em>{summary}</em>}{!open && spark && <Spark pts={spark} color={color} />}
      </h5>
      {open && children}
    </section>);
}
