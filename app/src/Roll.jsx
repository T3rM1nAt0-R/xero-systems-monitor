import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { play, motionFull, SLOW_MS } from "./motion.js";
import { rollDir } from "./chartFx.js";
import { isStartup, countText } from "./startup.js";
// A number that rolls like an odometer: the old text slides out and the new text slides in, up when the number went up and down when it went down.
// Only transform and opacity move (Full motion only; otherwise the text just changes), so a poll never makes the page re-layout per frame.
// At startup (see startup.js) a number first counts up from zero, once.
// `value` is text like "62", "4.1" or "317.2 KB/s".
const ROLL_FRACTION = 0.6, SLIDE = 70, COUNT_MS = 900;   // of the slow time; percent of the text height the text travels; how long the startup count-up takes
function Roll({ value }) {
  const text = value == null ? "" : String(value), [from, setFrom] = useState(null), last = useRef(text), outEl = useRef(null), inEl = useRef(null);
  const [count, setCount] = useState(() => (motionFull() && isStartup() ? 0 : null));
  if (text !== last.current) { const was = last.current; last.current = text; if (motionFull() && was) setFrom({ text: was, dir: rollDir(was, text) }); else if (from) setFrom(null); }
  useEffect(() => {
    if (count == null) return undefined;
    let raf = 0; const t0 = performance.now(), step = now => { const k = Math.min(1, (now - t0) / COUNT_MS); setCount(k < 1 ? k : null); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- once, when the number first appears
  useLayoutEffect(() => {
    if (!from) return undefined;
    const ms = SLOW_MS * ROLL_FRACTION, d = from.dir, a = play(outEl.current, [{ transform: "none", opacity: 1 }, { transform: `translateY(${-d * SLIDE}%)`, opacity: 0 }], ms, { full: true });
    play(inEl.current, [{ transform: `translateY(${d * SLIDE}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], ms, { full: true });
    const done = () => setFrom(null), t = setTimeout(done, ms + 40);
    if (a) a.onfinish = done;
    return () => clearTimeout(t);
  }, [from]);
  return <span className="roll"><span ref={inEl}>{count == null ? text : countText(text, count)}</span>{from && <span className="rout" ref={outEl} aria-hidden="true">{from.text}</span>}</span>;
}
export default memo(Roll);
