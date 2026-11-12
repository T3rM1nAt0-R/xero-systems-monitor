import { useLayoutEffect, useRef, useState } from "react";
// Keeps a box's height glued to its content with a short ease, so adding or removing a row slides instead of snapping.
export default function Smooth({ children, className = "" }) {
  const inner = useRef(null), [h, setH] = useState(null);
  useLayoutEffect(() => {
    const el = inner.current; if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    setH(el.offsetHeight); ro.observe(el); return () => ro.disconnect();
  }, []);
  return <div className="smooth" style={h == null ? undefined : { height: h }}><div ref={inner} className={className}>{children}</div></div>;
}
