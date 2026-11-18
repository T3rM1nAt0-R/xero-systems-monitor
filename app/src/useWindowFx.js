import { useEffect, useRef, useState } from "react";
import { motionLevel, play, MOTION_MS } from "./motion.js";
import { STARTUP_MS, startupBegin } from "./startup.js";
// Window-level motion. The startup cascade: for a moment after the first numbers arrive the cards come in one after another and their numbers count up
// (`cascade` is true for that moment; the CSS is in styles/windowfx.css). The morph: when the view changes between Full, Compact and Mini, the content fades and settles in.
export default function useWindowFx(appRef, ready, view) {
  const [cascade, setCascade] = useState(false), done = useRef(false), first = useRef(true);
  if (ready && !done.current) { done.current = true; if (motionLevel() === "full") { startupBegin(); setCascade(true); } }
  useEffect(() => { if (!cascade) return undefined; const t = setTimeout(() => setCascade(false), STARTUP_MS); return () => clearTimeout(t); }, [cascade]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    play(appRef.current, [{ opacity: 0.35, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], MOTION_MS * 1.6);
  }, [view]);   // eslint-disable-line react-hooks/exhaustive-deps -- `appRef` is a ref
  return cascade;
}
