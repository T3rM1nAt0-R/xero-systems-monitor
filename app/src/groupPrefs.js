import { createContext, useEffect, useState } from "react";
import { load, save } from "./store.js";
import { normGroups } from "./order.js";
// Which groups each machine shows, and in what order. Kept per machine in the browser; every card hears about changes made elsewhere (the palette, the Groups… menu).
const EVENT = "xsm:groups", REVEAL = "xsm:reveal";
export const GroupLayout = createContext(null);
export const loadGroups = name => normGroups(load("groups." + name, null));
export const saveGroups = (name, g) => { save("groups." + name, g); window.dispatchEvent(new Event(EVENT)); };
export function useGroupPrefs(name) {
  const [g, setG] = useState(() => loadGroups(name));
  useEffect(() => { const f = () => setG(loadGroups(name)); f(); window.addEventListener(EVENT, f); return () => window.removeEventListener(EVENT, f); }, [name]);
  return [g, next => saveGroups(name, next)];
}
// Ask one group (id is "machine.key") to open itself and scroll into view.
export const revealGroup = id => window.dispatchEvent(new CustomEvent(REVEAL, { detail: id }));
export const onReveal = fn => { const f = e => fn(e.detail); window.addEventListener(REVEAL, f); return () => window.removeEventListener(REVEAL, f); };
