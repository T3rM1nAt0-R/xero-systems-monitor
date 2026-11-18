import { useCallback, useRef, useState } from "react";
import useOutside from "./useOutside.js";
// A small ⋯ button with a popover of things you can do to one machine (today: hide it). Clicks stay inside, so a card header does not fold.
export default function MachineMenu({ name, onHide }) {
  const [open, setOpen] = useState(false), box = useRef(null), close = useCallback(() => setOpen(false), []);
  useOutside(open, box, close);
  const stop = e => e.stopPropagation();
  return (
    <span className="mmenu" ref={box} onClick={stop} onPointerDown={stop}>
      <button className="ghost mdots" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${name}`} data-tip="More">⋯</button>
      {open && <div className="menu down" role="menu"><button role="menuitem" onClick={() => { setOpen(false); onHide(name); }}>Hide this machine</button></div>}
    </span>);
}
