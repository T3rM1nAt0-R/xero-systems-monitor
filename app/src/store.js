import { useCallback, useRef, useSyncExternalStore } from "react";
// The one settings store of the window. Everything the window remembers (range, limits, fold choices, group layout, per-machine settings, themes)
// is a value under a key. A key is read from the browser (localStorage, guarded: private windows can refuse it) the first time, kept in memory,
// and written back on every change. Anyone can subscribe to a key and hears about changes made anywhere, including another window.
// Keys set with { persist: false } live in memory only (a "reveal this section" request, a fold-all that has just been asked for).
const PREFIX = "xm.";
const mem = new Map(), subs = new Map();

function readStored(k) {
  try { const v = localStorage.getItem(PREFIX + k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; }
}
function writeStored(k, v) {
  try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* private windows can refuse storage; the setting just is not kept */ }
}
function notify(k) { for (const f of [...(subs.get(k) || [])]) f(); }

// The value under `k`, or `d` when nothing was ever saved there.
export function get(k, d) {
  if (!mem.has(k)) { const v = readStored(k); if (v !== undefined) mem.set(k, v); }
  return mem.has(k) ? mem.get(k) : d;
}
// Set `k` and tell its subscribers. Setting the very same value changes nothing.
export function set(k, v, { persist = true } = {}) {
  if (mem.has(k) && Object.is(mem.get(k), v)) return;
  mem.set(k, v);
  if (persist) writeStored(k, v);
  notify(k);
}
// `fn` runs after `k` changes. Returns the way to stop listening.
export function subscribe(k, fn) {
  let s = subs.get(k); if (!s) subs.set(k, s = new Set());
  s.add(fn);
  return () => { s.delete(fn); };
}
// Same names as before: load and save are get and set.
export const load = get;
export const save = (k, v) => set(k, v);
// Keys that are in memory now and start with `prefix` (so "fold everything under card." can find them).
export const keysWith = prefix => [...mem.keys()].filter(k => k.startsWith(prefix));
// Forget what is in memory (tests; the browser copy stays).
export const forgetMemory = () => { mem.clear(); };

// Another window changed a saved value: take it over and tell our own subscribers.
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", e => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const k = e.key.slice(PREFIX.length);
    try { if (e.newValue == null) mem.delete(k); else mem.set(k, JSON.parse(e.newValue)); } catch { return; }
    notify(k);
  });
}

// [value, setter] for one key, shared by every component that uses the same key. `def` is used until something is saved; the setter takes a value or an updater function.
export function useSetting(key, def) {
  const d = useRef(undefined);
  if (d.current === undefined) d.current = { v: typeof def === "function" ? def() : def };   // the default keeps one identity, so the snapshot is stable
  const value = useSyncExternalStore(useCallback(f => subscribe(key, f), [key]), () => get(key, d.current.v));
  const put = useCallback(v => set(key, typeof v === "function" ? v(get(key, d.current.v)) : v), [key]);
  return [value, put];
}
// useState that remembers its value between runs (and shares it with everything else reading the same key).
export const usePersisted = useSetting;
