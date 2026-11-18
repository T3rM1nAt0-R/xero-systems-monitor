import { createContext, useCallback, useMemo } from "react";
import { get, set, subscribe, useSetting } from "./store.js";
import { normGroups } from "./order.js";
// Which sections each machine shows, and in what order. Kept per machine in the settings store ("groups.<machine>"); every card hears about changes made elsewhere (the palette, the Groups… menu).
const key = name => "groups." + name;
export const GroupLayout = createContext(null);
export const loadGroups = name => normGroups(get(key(name), null));
export const saveGroups = (name, g) => set(key(name), g);
export function useGroupPrefs(name) {
  const [raw, put] = useSetting(key(name), null);
  const g = useMemo(() => normGroups(raw), [raw]);   // same object until the saved value changes
  return [g, useCallback(next => put(next), [put])];
}
// Ask one section (id is "machine.key") to open itself and scroll into view. The request is a value in the store that is never saved; the counter makes asking twice count twice.
const REVEAL = "reveal";
let asks = 0;
export const revealGroup = id => set(REVEAL, { id, n: ++asks }, { persist: false });
export const onReveal = fn => subscribe(REVEAL, () => { const r = get(REVEAL); if (r) fn(r.id); });
