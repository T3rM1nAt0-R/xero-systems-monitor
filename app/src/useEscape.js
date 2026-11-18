import { useEffect } from "react";
// While a dialog is open, the Escape key closes it. Every dialog calls this once with its own close function.
export default function useEscape(onClose) {
  useEffect(() => { const k = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
}
