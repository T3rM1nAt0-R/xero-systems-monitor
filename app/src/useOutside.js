import { useEffect } from "react";
// While `open`, a press outside `box` (a ref) or the Escape key calls `close`.
export default function useOutside(open, box, close) {
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!box.current?.contains(e.target)) close(); }, esc = e => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open, box, close]);
}
