import { useLayoutEffect, useRef } from "react";
import { play, motionFull } from "./motion.js";
// FLIP for a list of cards: when the order or the set of children (named by `key`) changes, each card glides from where it was to where it is now,
// and a card that appears fades in. The old positions are read during render (before React changes the page); only transform and opacity animate.
// Children need an `id`. Nothing runs between changes, so a poll costs nothing here.
const GLIDE_MS = 420;
const rects = el => new Map([...el.children].filter(c => c.id).map(c => { const r = c.getBoundingClientRect(); return [c.id, { x: r.left + window.scrollX, y: r.top + window.scrollY }]; }));
export default function useFlip(ref, key) {
  const seen = useRef(key), before = useRef(null);
  if (seen.current !== key) { seen.current = key; before.current = ref.current ? rects(ref.current) : null; }
  useLayoutEffect(() => {
    const was = before.current; before.current = null;
    if (!was || !was.size || !ref.current || !motionFull()) return;
    for (const c of ref.current.children) {
      const a = was.get(c.id); if (!c.id) continue;
      if (!a) { play(c, [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], GLIDE_MS, { full: true }); continue; }
      const r = c.getBoundingClientRect(), dx = a.x - (r.left + window.scrollX), dy = a.y - (r.top + window.scrollY);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) play(c, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], GLIDE_MS, { full: true });
    }
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps -- `ref` is a ref
}
