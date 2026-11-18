import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getBusyAt } from "./api.js";
import { busyRows } from "./busyAt.js";
import { pauseHover } from "./hoverGroup.js";
import { hm, dayHm } from "./format.js";
// "What was busy then?": the small box that opens where you click a CPU or memory graph.
// It asks the collector for the busiest programs near that moment and closes on Esc, a click elsewhere, or scrolling.
const W = 270, M = 8;   // box width, and the gap kept to the window edge
export default function BusyPopover({ machine, t, x, y, range, onClose }) {
  const [answer, setAnswer] = useState(null), box = useRef(null);
  useEffect(() => {
    let live = true;
    getBusyAt(machine, t).then(r => live && setAnswer(r || {}), () => live && setAnswer({}));
    return () => { live = false; };
  }, [machine, t]);
  useEffect(() => {
    const key = e => e.key === "Escape" && onClose(), down = e => { if (!box.current?.contains(e.target)) onClose(); };
    document.addEventListener("keydown", key); document.addEventListener("mousedown", down); window.addEventListener("scroll", onClose, true);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", down); window.removeEventListener("scroll", onClose, true); };
  }, [onClose]);
  useEffect(() => { pauseHover(true); return () => pauseHover(false); }, []);
  useLayoutEffect(() => {   // once the real height is known, pull the box fully inside the window
    const el = box.current; if (!el) return;
    el.style.left = Math.max(M, Math.min(x + 12, window.innerWidth - el.offsetWidth - M)) + "px";
    el.style.top = Math.max(M, Math.min(y + 14, window.innerHeight - el.offsetHeight - M)) + "px";
  }, [x, y, answer]);
  const rows = busyRows(answer), at = (range > 86400 ? dayHm : hm)(t);
  const style = { left: Math.max(M, Math.min(x + 12, window.innerWidth - W - M)), top: y + 14 };
  return createPortal(
    <div className="busypop" ref={box} style={style} role="dialog" aria-label={`What was busy at ${at}`}>
      <div className="bp-h"><b>At {at}</b><button type="button" onClick={onClose} aria-label="Close">×</button></div>
      {answer === null ? <div className="quiet">Looking…</div>
        : rows.length ? rows.map(r => <div className="bp-r" key={r.name}><span data-tip={r.name}>{r.name}</span><em>{r.cpu}</em><em>{r.mem}</em></div>)
        : <div className="quiet">No program details were kept for that moment.</div>}
    </div>, document.body);
}
