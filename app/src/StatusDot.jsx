import { useEffect, useRef, useState } from "react";
import { DOT_FX_MS } from "./motion.js";
// A status dot. It breathes slowly (faster and amber when the machine needs a look); when the machine comes online a green ripple spreads from it,
// and when it goes offline it fades slowly to a grey ring. All of it is CSS (styles/statusfx.css); this only says which effect to play for a moment.
export default function StatusDot({ off = false, warn = false }) {
  const was = useRef(off), [fx, setFx] = useState("");
  useEffect(() => {
    if (was.current === off) return undefined;
    was.current = off; setFx(off ? "falling" : "rising");
    const t = setTimeout(() => setFx(""), DOT_FX_MS);
    return () => clearTimeout(t);
  }, [off]);
  return <i className={"dot" + (off ? " off" : "") + (warn && !off ? " warn" : "") + (fx ? " " + fx : "")} />;
}
