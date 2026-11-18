import { useEffect, useRef } from "react";
import { lookLabel, lookTarget } from "./pick.js";
// While `active`, hovering the window outlines the element under the pointer (one fixed box moved by direct style writes, no React render) and names it;
// a click is swallowed and `onPick(id)` is called. Returns refs for the box and its label.
export default function usePick(active, onPick) {
  const box = useRef(null), label = useRef(null), last = useRef(null);   // last: the element outlined now
  useEffect(() => {
    if (!active) return undefined;
    const show = t => {
      const b = box.current; if (!b) return;
      if (!t) { b.hidden = true; last.current = null; return; }
      const r = t.el.getBoundingClientRect();
      Object.assign(b.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      label.current.textContent = lookLabel(t.id); b.hidden = false; last.current = t.el;
    };
    const move = e => { const t = lookTarget(e.target); if ((t?.el ?? null) !== last.current) show(t); };
    const click = e => { const t = lookTarget(e.target); if (!t) return; e.preventDefault(); e.stopPropagation(); onPick(t.id); };
    document.addEventListener("pointermove", move, true); document.addEventListener("click", click, true);
    document.documentElement.dataset.picking = "on";
    return () => { document.removeEventListener("pointermove", move, true); document.removeEventListener("click", click, true); delete document.documentElement.dataset.picking; show(null); };
  }, [active, onPick]);
  return { box, label };
}
