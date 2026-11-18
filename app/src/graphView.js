// What the graph tools share between components: the compare choice (one for the whole window) and each machine's zoom span.
import { useSyncExternalStore } from "react";
import { set, useSetting } from "./store.js";
const zooms = new Map(), subs = new Set();
const tell = () => subs.forEach(f => f());
const sub = f => { subs.add(f); return () => subs.delete(f); };
export const setCompare = s => set("compare", s);
export const useCompare = () => useSetting("compare", 0)[0];
export const setZoom = (machine, span) => { if (span) zooms.set(machine, span); else zooms.delete(machine); tell(); };   // span: [t0, t1] in seconds, or null
export const useZoom = machine => useSyncExternalStore(sub, () => zooms.get(machine) || null);
let all = {};   // every machine's graph history, so one graph opened full-window can overlay the same metric from the other machines
export const publishHistory = h => { all = h; tell(); };
export const useAllHistory = () => useSyncExternalStore(sub, () => all);
