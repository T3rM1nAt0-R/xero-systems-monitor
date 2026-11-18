import { useEffect, useRef, useState } from "react";
import { motionMs } from "./motion.js";
// Shows its children when `open`, folding them smoothly (height and opacity, see .collapse in styles/motion.css) instead of cutting them.
// The children stay on screen until the fold has finished, then leave the page so a folded card costs nothing.
export default function Collapse({ open, children }) {
  const [mounted, setMounted] = useState(open), [shown, setShown] = useState(open), [busy, setBusy] = useState(false), first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }   // already in its starting state
    const ms = motionMs();
    if (open) {
      setMounted(true); setBusy(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))), t = setTimeout(() => setBusy(false), ms + 20);   // two frames: the closed look must be painted before it can transition
      return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    }
    setShown(false); setBusy(true);
    const t = setTimeout(() => { setMounted(false); setBusy(false); }, ms);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return <div className={"collapse" + (shown ? " open" : "") + (busy ? " busy" : "")}><div className="collapse-in">{children}</div></div>;
}
