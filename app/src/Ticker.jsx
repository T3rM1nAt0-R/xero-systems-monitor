import { useLayoutEffect, useRef, useState } from "react";
// One line of text that fits its box. If the text is longer than the box, it slides to the end and back, slowly,
// so a long name can always be read in full. Short text stays still. Needs `text` as a plain string.
export default function Ticker({ text, className = "", speed = 28 }) {
  const box = useRef(null), txt = useRef(null), [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const b = box.current, t = txt.current; if (!b || !t) return;
    const measure = () => { const d = Math.ceil(t.scrollWidth - b.clientWidth); setShift(d > 1 ? d : 0); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(b); ro.observe(t); return () => ro.disconnect();
  }, [text]);
  const style = shift ? { "--shift": `-${shift}px`, "--dur": `${(shift / speed + 4).toFixed(1)}s` } : undefined;
  return <span className={"tick " + className} ref={box} data-run={shift ? 1 : 0} data-tip={shift ? text : undefined} style={style}><span ref={txt}>{text}</span></span>;
}
