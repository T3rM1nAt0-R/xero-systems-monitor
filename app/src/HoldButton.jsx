import { useState, useRef, useEffect } from "react";
import { HOLD_MS } from "./system.js";
// A button that does its job only after it is held down for about 800 ms (mouse, touch, or Space/Enter), so it cannot be clicked by accident.
// A quick press just shows the hint. The fill that grows while holding is drawn by CSS (.hold.on i).
export default function HoldButton({ children, onHold, disabled, className = "", hint = "Hold to confirm" }) {
  const [on, setOn] = useState(false), timer = useRef(0);
  const stop = () => { clearTimeout(timer.current); setOn(false); };
  const start = () => { if (disabled || on) return; setOn(true); timer.current = setTimeout(() => { setOn(false); onHold(); }, HOLD_MS); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const key = fn => e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); fn(); } };
  return (
    <button type="button" className={`hold ${className}${on ? " on" : ""}`} disabled={disabled} data-tip={hint} aria-label={`${typeof children === "string" ? children : "Action"}. ${hint}`}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onKeyDown={key(start)} onKeyUp={key(stop)} onBlur={stop} onContextMenu={e => e.preventDefault()}>
      <i style={{ "--hold": HOLD_MS + "ms" }} />{children}
    </button>);
}
