import { useCallback, useRef, useState } from "react";
import useOutside from "./useOutside.js";
import { GRAPH_TITLES, SIZES, graphsFor, graphShown, sizeOf, toggleGraph, togglePinGraph, setGraphSize } from "./graphPrefs.js";
// A small ⋯ button with a popover of things you can do to one machine: choose its Overview graphs (show, size S/M/L, pin) and hide it. Clicks stay inside, so a card header does not fold.
export default function MachineMenu({ name, onHide, m, h, settings, patch }) {
  const [open, setOpen] = useState(false), box = useRef(null), close = useCallback(() => setOpen(false), []);
  useOutside(open, box, close);
  const stop = e => e.stopPropagation(), g = settings?.graphs;
  const set = f => patch({ graphs: f(g) });
  return (
    <span className="mmenu" ref={box} onClick={stop} onPointerDown={stop}>
      <button className="ghost mdots" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${name}`} data-tip="More">⋯</button>
      {open && <div className="menu down" role="menu">
        {g && m && <><div className="mlabel">Graphs on Overview</div>
          {graphsFor(m, h).map(k => <div className="grow3" key={k}>
            <button role="menuitemcheckbox" aria-checked={graphShown(g, k)} className="mrow2" onClick={() => set(x => toggleGraph(x, k))}><span className="mtxt">{GRAPH_TITLES[k]}</span><i className={"sw" + (graphShown(g, k) ? " on" : "")} /></button>
            <span className="seg" role="group" aria-label={GRAPH_TITLES[k] + " size"}>{SIZES.map(s => <button key={s} className={sizeOf(g, k) === s ? "on" : ""} onClick={() => set(x => setGraphSize(x, k, s))}>{s}</button>)}</span>
            <button className={"pin" + (g.pin.includes(k) ? " on" : "")} aria-pressed={g.pin.includes(k)} aria-label={(g.pin.includes(k) ? "Unpin " : "Pin ") + GRAPH_TITLES[k]} data-tip={g.pin.includes(k) ? "Pinned: always shown, first in its row" : "Pin: always show, first in its row"} onClick={() => set(x => togglePinGraph(x, k))}>{g.pin.includes(k) ? "Pinned" : "Pin"}</button>
          </div>)}<hr /></>}
        <button role="menuitem" onClick={() => { setOpen(false); onHide(name); }}>Hide this machine</button></div>}
    </span>);
}
