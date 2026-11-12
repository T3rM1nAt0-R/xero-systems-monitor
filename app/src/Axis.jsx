import { useLayoutEffect, useRef, useState } from "react";
import { when, axisTicks } from "./format.js";
// The time labels under a graph: round clock times (15 min, 30 min, 1 h ...) and "now" at the right edge.
// A narrow graph gets fewer labels, so they never run into each other.
export default function Axis({ t0, t1, range, className = "" }) {
  const ref = useRef(null), [w, setW] = useState(400);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); setW(el.clientWidth); ro.observe(el); return () => ro.disconnect(); }, []);
  const max = Math.max(1, Math.min(4, Math.floor(w / 95)));   // about 95 px per "10:00 PM" label
  let ticks = axisTicks(t0, t1, 4);
  if (max < 3) { const mid = (t0 + t1) / 2; const best = ticks.filter(t => Math.abs(t - mid) < (t1 - t0) * .22).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]; ticks = best ? [best] : []; }   // narrow: one label in the middle, or none
  else ticks = axisTicks(t0, t1, max);
  return <div ref={ref} className={"xax " + className}>{ticks.map(t => <span key={t} style={{ left: ((t - t0) / (t1 - t0)) * 100 + "%" }}>{when(t, range)}</span>)}<span className="now" style={{ right: 0 }}>now</span></div>;
}
