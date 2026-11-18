import { useState, useEffect, useRef } from "react";
import { get, set, subscribe, useSetting } from "./store.js";
import { motionFull } from "./motion.js";
// One folding mechanism for everything that opens and shuts: groups, small sections, whole machine cards.
// The choice is kept per machine in the settings store under "col."+id (1 = open, 0 = folded). foldAll() reaches every fold on screen whose id starts with a prefix.
export const CARD = "card.";   // prefix of every machine card's fold id
const COL = "col.", ASKED = "fold-asked.";
const mounted = new Map();     // id -> how many folds with that id are on screen
let asks = 0;
// `exact` reaches only the fold whose id is the prefix itself (so "srv" does not also reach "srv2").
export const reaches = (id, { prefix, exact }) => exact ? id === prefix : id.startsWith(prefix);
// Where a fold sits on screen (cards are "m-name", groups "g-id"), so fold all can ripple from the top down.
const topOf = id => document.getElementById(id.startsWith(CARD) ? "m-" + id.slice(CARD.length) : "g-" + id)?.getBoundingClientRect().top ?? 0;
const RIPPLE_STEP_MS = 70, RIPPLE_MAX_STEPS = 8;   // each fold starts a little after the one above it, for at most this many steps
export function foldAll(open, prefix = "", exact = false) {
  const ask = { open, prefix, exact }, hit = [...mounted.keys()].filter(id => reaches(id, ask));
  const apply = id => {
    set(COL + id, open ? 1 : 0);
    set(ASKED + id, { open, n: ++asks }, { persist: false });   // lets a card tell "folded by fold all" from "folded by a click"
  };
  if (hit.length < 2 || typeof document === "undefined" || !motionFull()) { hit.forEach(apply); return; }
  hit.sort((a, b) => topOf(a) - topOf(b)).forEach((id, i) => (i ? setTimeout(() => apply(id), Math.min(i, RIPPLE_MAX_STEPS) * RIPPLE_STEP_MS) : apply(id)));
}
// Runs `fn(open)` when foldAll() reaches this id.
export function useFoldEvent(id, fn) {
  const f = useRef(fn); f.current = fn;
  useEffect(() => {
    let last = get(ASKED + id);
    return subscribe(ASKED + id, () => { const a = get(ASKED + id); if (a && a !== last) { last = a; f.current(a.open); } });
  }, [id]);
}
// [open, flip, set]: a remembered open/shut flag.
export function useFold(id, def = true) {
  const [v, put] = useSetting(COL + id, null);
  useEffect(() => { mounted.set(id, (mounted.get(id) || 0) + 1); return () => { const n = (mounted.get(id) || 1) - 1; if (n) mounted.set(id, n); else mounted.delete(id); }; }, [id]);
  const open = v == null ? def : v === 1, setOpen = o => put(o ? 1 : 0);
  return [open, () => setOpen(!open), setOpen];
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
