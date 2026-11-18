import { useLayoutEffect, useRef } from "react";
import { play, motionFull, SLOW_MS, MOTION_MS, PULSE_MS } from "./motion.js";
import { fxKind, CROSS_GLOW_MS, STRETCH_MS, WAIT_MS } from "./chartFx.js";
// The graph's motion, all played on the compositor (transform / opacity / clip) so a poll never makes the page re-layout:
// the picture slides left as time passes (new points enter from the right), stretches when the range changes, draws in from the left
// when it first has data or when the new range's data arrives, and glows the card edge when the line crosses its limit.
// `els` are the elements that move together (the svg and the marks layer); `pts` is the first series' data; `last` its newest value.
export default function useChartFx(els, { t0, t1, pts, last, thr, ready, root, layer }) {
  const prev = useRef(null), waiting = useRef(false), seen = useRef(pts), over = useRef(false), glow = useRef(0), wt = useRef(0);
  useLayoutEffect(() => {
    const p = prev.current, list = els.map(r => r.current).filter(Boolean), kind = fxKind(p, { t0, t1, ready });
    prev.current = { t0, t1, ready };
    const drawIn = () => { for (const el of list) play(el, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], SLOW_MS, { full: true }) || play(el, [{ opacity: 0.3 }, { opacity: 1 }], MOTION_MS); };
    if (kind === "first") drawIn();
    else if (kind === "stretch") { waiting.current = true; clearTimeout(wt.current); wt.current = setTimeout(() => { waiting.current = false; }, WAIT_MS); for (const el of list) play(el, [{ transform: `scaleX(${(t1 - t0) / (p.t1 - p.t0)})`, opacity: 0.5 }, { transform: "none", opacity: 1 }], STRETCH_MS); }
    else if (kind === "slide") { const s = ((t1 - p.t1) / (t1 - t0)) * 100; for (const el of list) play(el, [{ transform: `translateX(${s}%)` }, { transform: "none" }], SLOW_MS); }
    if (kind === "slide" || kind === "first") for (const ring of layer.current?.querySelectorAll("u") || []) play(ring, [{ transform: "scale(1)", opacity: 0.8 }, { transform: "scale(3.2)", opacity: 0 }], PULSE_MS, { full: true });   // one soft pulse per new point
    if (waiting.current && pts !== seen.current && kind !== "stretch") { waiting.current = false; drawIn(); }
    seen.current = pts;
  }, [t0, t1, pts, ready]);   // eslint-disable-line react-hooks/exhaustive-deps -- `els` are refs
  useLayoutEffect(() => {
    const now = thr != null && last != null && last >= thr, card = root.current?.closest(".card");
    if (now && !over.current && motionFull() && card) { card.classList.add("edge-glow"); clearTimeout(glow.current); glow.current = setTimeout(() => card.classList.remove("edge-glow"), CROSS_GLOW_MS); }
    over.current = now;
  }, [last, thr]);   // eslint-disable-line react-hooks/exhaustive-deps -- `root` is a ref
  useLayoutEffect(() => () => { clearTimeout(glow.current); clearTimeout(wt.current); }, []);
}
