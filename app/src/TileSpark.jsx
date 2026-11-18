import { useLayoutEffect, useRef } from "react";
import { play, SLOW_MS } from "./motion.js";
import { sparkPoints } from "./strip.js";
// The little CPU line on a machine tile. Like a heart monitor, it scrolls left by one step whenever a new reading arrives (Full motion; transform only).
export default function TileSpark({ pts, w, h }) {
  const el = useRef(null), last = useRef(pts.length ? pts[pts.length - 1][0] : null), line = sparkPoints(pts, w, h);
  const t = pts.length ? pts[pts.length - 1][0] : null;
  useLayoutEffect(() => {
    if (t !== last.current && last.current != null && pts.length > 1) play(el.current, [{ transform: `translateX(${w / (pts.length - 1)}px)` }, { transform: "none" }], SLOW_MS, { full: true });
    last.current = t;
  }, [t]);   // eslint-disable-line react-hooks/exhaustive-deps -- a new reading is a new last time
  if (!line) return null;
  return <svg ref={el} className="tspark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>;
}
