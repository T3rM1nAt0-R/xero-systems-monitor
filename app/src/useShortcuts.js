import { useEffect, useRef } from "react";
// One-key shortcuts. `h` is a bag of the current values and actions; the listener always reads the latest one.
export default function useShortcuts(h) {
  const r = useRef(h); r.current = h;
  useEffect(() => {
    const k = e => {
      const { dlg, setDlg, help, setHelp, menu, setMenu, showEv, closeEv, openEv, ms, open, ranges, range, setRange, setCompact, toggleMini, setPin } = r.current;
      if (/input|textarea/i.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") { if (dlg) setDlg(false); else if (help) setHelp(false); else if (menu) setMenu(false); else if (showEv) closeEv(); return; }
      const i = ranges.findIndex(x => x[1] === range), key = e.key.toLowerCase();
      if (/^[1-9]$/.test(e.key)) { const m = ms[+e.key - 1]; if (m) open(m.name); }
      else if (key === "c" || key === "s") setCompact(x => !x);
      else if (key === "m") toggleMini();
      else if (key === "t") setPin(x => !x);
      else if (key === "e") (showEv ? closeEv() : openEv());
      else if (e.key === "[") setRange(ranges[Math.max(0, i - 1)][1]);
      else if (e.key === "]") setRange(ranges[Math.min(ranges.length - 1, i + 1)][1]);
      else if (e.key === "?") setHelp(x => !x);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
}
