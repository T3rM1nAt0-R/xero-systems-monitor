import { useCallback, useMemo, useSyncExternalStore } from "react";
import { get, subscribe } from "../store.js";
import { machineKey, normMachine } from "../machineSettings.js";
// A machine's own colour tints its card edge and its tile through the --mc and --edge custom properties (see card.css, compact.css).
export const tint = color => (color ? { "--mc": color, "--edge": "calc(3px * var(--scale))" } : undefined);

// { machine name: colour or "" } for a list of machines, one subscription for all of them.
export function useMachineColors(ms) {
  const key = ms.map(m => m.name).join("\n");
  const names = useMemo(() => (key ? key.split("\n") : []), [key]);
  const sub = useCallback(f => { const stops = names.map(n => subscribe(machineKey(n), f)); return () => stops.forEach(s => s()); }, [names]);
  const snap = useSyncExternalStore(sub, () => names.map(n => normMachine(get(machineKey(n), null)).color).join("|"));
  return useMemo(() => Object.fromEntries(names.map((n, i) => [n, snap.split("|")[i]])), [names, snap]);
}
