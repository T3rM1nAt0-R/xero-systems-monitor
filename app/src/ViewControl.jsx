import { useCallback, useRef, useState } from "react";
import useOutside from "./useOutside.js";
import { useAnyCardOpen } from "./fold.js";
import { VIEWS, STRIP_MODES, viewOf, viewChange } from "./view.js";
const TIPS = { full: "Full window: every machine as a card", compact: "Compact: one row per machine (C)", mini: "Mini: small corner view (M)" };
// The one view control: a Full | Compact | Mini switch, a pin button (always on top), and a View menu (fold all, only in Full and named from what the cards really are; strip; hidden machines).
export default function ViewControl({ compact, mini, setCompact, setMini, pin, setPin, canFold, foldMachines, stripMode, setStripMode, hiddenCount, onHidden }) {
  const [open, setOpen] = useState(false), anyOpen = useAnyCardOpen(), box = useRef(null), cur = viewOf(compact, mini), shut = useCallback(() => setOpen(false), []);
  useOutside(open, box, shut);
  const pick = want => { const c = viewChange(want); if (c.compact !== null) setCompact(c.compact); if (c.mini !== mini) setMini(c.mini); };
  const close = fn => () => { setOpen(false); fn(); };
  return (
    <>
      <div className="seg viewseg" role="group" aria-label="View">{VIEWS.map(([k, l]) => <button key={k} className={cur === k ? "on" : ""} aria-pressed={cur === k} onClick={() => pick(k)} data-tip={TIPS[k]}>{l}</button>)}</div>
      <button className={"pinbtn" + (pin ? " on" : "")} onClick={() => setPin(!pin)} aria-pressed={pin} aria-label="Keep on top" data-tip="Keep on top (T)">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 1.5l5 5-2 .8-2.6 2.6.2 3.1-1 1-3-3-4.4 4.4-.7-.7 4.4-4.4-3-3 1-1 3.1.2 2.6-2.6z" fill={pin ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>
      </button>
      <span className="menuwrap" ref={box}>
        <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>View ▾</button>
        {open && <div className="menu down" role="menu">
          {canFold && <button role="menuitem" onClick={close(() => foldMachines(!anyOpen))} data-tip="Fold every machine into one bar, or open them all (F, Shift+F)">{anyOpen ? "Fold all" : "Unfold all"}</button>}
          <div className="mseg" role="group" aria-label="Show machines strip"><span>Machines strip</span>
            <div className="seg">{STRIP_MODES.map(([k, l]) => <button key={k} className={stripMode === k ? "on" : ""} onClick={() => setStripMode(k)}>{l}</button>)}</div></div>
          <hr />
          <button role="menuitem" onClick={close(onHidden)}>Hidden machines…{hiddenCount > 0 && <em className="hcount">{hiddenCount}</em>}</button>
        </div>}
      </span>
    </>);
}
