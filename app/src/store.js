import { useEffect, useState } from "react";
// Little settings kept in the browser (localStorage). Every read and write is guarded: private windows can refuse it.
export const load = (k, d) => { try { const v = localStorage.getItem("xm." + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
export const save = (k, v) => { try { localStorage.setItem("xm." + k, JSON.stringify(v)); } catch { /* private windows can refuse storage; the setting just is not kept */ } };
// useState that remembers its value between runs.
export function usePersisted(key, init) {
  const [v, setV] = useState(() => load(key, typeof init === "function" ? init() : init));
  useEffect(() => save(key, v), [key, v]);
  return [v, setV];
}
