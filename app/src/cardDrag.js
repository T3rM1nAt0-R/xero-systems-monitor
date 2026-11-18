import { useRef } from "react";
const MIN_PX = 6;   // how far the pointer must travel before a press counts as a drag
// Drag a machine card by its header to reorder. Pointer events (not HTML drag and drop) so it also works inside the Windows webview.
// Returns a pointer-down handler for the grid; `onMove(from, to)` is called on drop.
export default function useCardDrag(onMove) {
  const cb = useRef(onMove); cb.current = onMove;
  return e => {
    const head = e.target.closest(".chead"), art = head?.closest("article.card");
    if (!art || e.button !== 0 || e.target.closest("button,a,input,label")) return;
    const from = art.id.slice(2), y0 = e.clientY; let moved = false, over = null;
    const mark = el => { if (over !== el) { over?.classList.remove("dropto"); el?.classList.add("dropto"); over = el; } };
    const mv = ev => {
      if (!moved && Math.abs(ev.clientY - y0) < MIN_PX) return;
      if (!moved) { moved = true; art.classList.add("dragging"); document.body.classList.add("dragging-card"); }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("article.card");
      mark(el && el !== art ? el : null);
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const to = over?.id.slice(2); mark(null); art.classList.remove("dragging"); document.body.classList.remove("dragging-card");
      if (moved && to) cb.current(from, to);
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
}
