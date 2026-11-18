import { useEffect, useRef, useState } from "react";
import { HOLD_MS, holdProgress } from "./procs.js";
// A button that only acts after being held down (mouse, touch, or Space / Enter): a fill grows across it, and letting go early cancels.
// It protects actions that cannot be undone, such as ending a program.
export default function HoldButton({ label, title, onDone, ms = HOLD_MS, disabled }) {
  const [p, setP] = useState(0), start = useRef(0), raf = useRef(0);
  const stop = () => { cancelAnimationFrame(raf.current); start.current = 0; setP(0); };
  const tick = () => {
    const v = holdProgress(performance.now() - start.current, ms);
    if (v >= 1) { stop(); onDone(); return; }
    setP(v); raf.current = requestAnimationFrame(tick);
  };
  const begin = () => { if (disabled || start.current) return; start.current = performance.now(); raf.current = requestAnimationFrame(tick); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const key = e => e.key === " " || e.key === "Enter";
  return (
    <button type="button" className="holdbtn" disabled={disabled} data-tip={title} aria-label={`${label}: ${title}`}
      onPointerDown={begin} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (key(e)) { e.preventDefault(); begin(); } }} onKeyUp={e => key(e) && stop()} onBlur={stop}>
      <i style={{ width: p * 100 + "%" }} /><span>{p > 0 ? "Keep holding…" : label}</span>
    </button>);
}
