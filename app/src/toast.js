import { useSyncExternalStore } from "react";
// Small messages that slide in at the bottom ("Saved picture", "Copied") and leave by themselves. One list for the whole window.
export const TOAST_MS = 2200, MAX_TOASTS = 3;
let list = [], next = 1;
const subs = new Set();
const emit = () => { list = [...list]; subs.forEach(f => f()); };
// Show a message. Returns its id.
export function toast(text) {
  const id = next++;
  list = [...list.slice(-(MAX_TOASTS - 1)), { id, text }];
  emit();
  setTimeout(() => dismiss(id), TOAST_MS);
  return id;
}
export function dismiss(id) { if (list.some(t => t.id === id)) { list = list.filter(t => t.id !== id); emit(); } }
export const useToasts = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => list);
// The messages now showing (for tests).
export const toastsNow = () => list;
