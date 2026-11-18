import { useCallback, useMemo } from "react";
import { get, set, useSetting } from "./store.js";
import { SECTION_IDS, TAB_IDS } from "./sections/meta.js";
import { normGraphs, DEFAULT_GRAPHS } from "./graphPrefs.js";
// What one machine remembers about how it looks: its own colour, which tab it opens on, and which sections are pinned to Overview.
// Kept in the settings store under "machine.<name>". The pure part (normMachine, patchMachine) cleans whatever was saved, so old or hand-edited values never break a card.
export const machineKey = name => "machine." + name;
export const DEFAULT_MACHINE = Object.freeze({ color: "", tab: TAB_IDS[0], pinned: Object.freeze([]), graphs: DEFAULT_GRAPHS, strip: "day" });
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\))$/i;

// The saved value turned into { color, tab, pinned, graphs, strip }: a CSS colour or "", a known tab, known section ids once each, the graph choices (graphPrefs.js) and the outage strip span ("day" or "week").
export function normMachine(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_MACHINE;
  const color = typeof raw.color === "string" && COLOR.test(raw.color.trim()) ? raw.color.trim() : DEFAULT_MACHINE.color;
  const tab = TAB_IDS.includes(raw.tab) ? raw.tab : DEFAULT_MACHINE.tab;
  const pinned = (Array.isArray(raw.pinned) ? raw.pinned : []).filter((k, i, a) => SECTION_IDS.includes(k) && a.indexOf(k) === i);
  const strip = raw.strip === "week" ? "week" : "day";
  return { color, tab, pinned, graphs: normGraphs(raw.graphs), strip };
}
// The settings with some fields changed, cleaned.
export const patchMachine = (raw, patch) => normMachine({ ...normMachine(raw), ...patch });
// Pin a section to Overview, or take it off again.
export const togglePinned = (s, id) => ({ ...s, pinned: s.pinned.includes(id) ? s.pinned.filter(k => k !== id) : [...s.pinned, id] });

// [settings, patch] for one machine. `settings` keeps one identity until something changes, so a memoised card can take it as a prop.
export function useMachineSettings(name) {
  const [raw] = useSetting(machineKey(name), null);
  const settings = useMemo(() => normMachine(raw), [raw]);
  const patch = useCallback(p => set(machineKey(name), patchMachine(get(machineKey(name), null), p)), [name]);
  return [settings, patch];
}
