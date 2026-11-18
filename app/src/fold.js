import { useState, useEffect, useRef } from "react";
import { load, save } from "./store.js";
// One folding mechanism for everything that opens and shuts: groups, small sections, whole machine cards.
// The choice is kept per machine under "col."+id (1 = open, 0 = folded). foldAll() reaches every fold whose id starts with a prefix.
const EVT = "xm-fold";
export const CARD = "card.";   // prefix of every machine card's fold id
const read = (id, def) => { const v = load("col." + id, null); return v == null ? def : v === 1; };
// `exact` reaches only the fold whose id is the prefix itself (so "srv" does not also reach "srv2").
export const foldAll = (open, prefix = "", exact = false) => window.dispatchEvent(new CustomEvent(EVT, { detail: { open, prefix, exact } }));
export const reaches = (id, { prefix, exact }) => exact ? id === prefix : id.startsWith(prefix);
// Runs `fn(open)` when foldAll() reaches an id that starts with the prefix.
export function useFoldEvent(id, fn) {
  const f = useRef(fn); f.current = fn;
  useEffect(() => {
    const on = e => { if (reaches(id, e.detail)) f.current(e.detail.open); };
    window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on);
  }, [id]);
}
// [open, flip, set]: a remembered open/shut flag.
export function useFold(id, def = true) {
  const [open, setOpen] = useState(() => read(id, def));
  const set = o => { save("col." + id, o ? 1 : 0); setOpen(o); };
  useFoldEvent(id, set);
  return [open, () => set(!open), set];
}
// Props that make a header a keyboard-friendly button.
export const foldProps = (open, flip) => ({ role: "button", tabIndex: 0, "aria-expanded": open, onClick: flip, onKeyDown: e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), flip()) });
// Is a machine card open? A click (or fold all) made while the machine looked like this wins until it changes (calm <-> needs a look).
// `auto` is the "Fold calm machines" switch; `base` is the remembered choice used when it is off.
export const cardOpen = (auto, calm, ov, base) => ov && ov.calm === calm ? ov.open : auto ? !calm : base;
export function useCardFold(name, calm, auto) {
  const [base, , setBase] = useFold(CARD + name, true), [ov, setOv] = useState(null), c = useRef(calm); c.current = calm;
  useFoldEvent(CARD + name, o => setOv({ open: o, calm: c.current }));   // fold all beats the calm rule too
  const open = cardOpen(auto, calm, ov, base);
  return [open, () => { setOv({ open: !open, calm }); setBase(!open); }];
}
