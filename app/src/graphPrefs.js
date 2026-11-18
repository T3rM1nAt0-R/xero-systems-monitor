// Which graphs a machine shows on Overview, how big each one is, and which are pinned. Pure: machineSettings.js stores it, Detail.jsx and the card menu read it.
// Shape: { off: [graph key], size: { key: "S" | "L" }, pin: [graph key] }. A pinned graph always shows, and comes first in its row. "M" is the normal size and is not stored.
export const GRAPH_KEYS = ["cpu", "temp", "ram", "gpu", "gtemp", "vram", "down", "up", "ping", "disk"];
export const GRAPH_TITLES = { cpu: "CPU", temp: "CPU temp", ram: "Memory", gpu: "GPU", gtemp: "GPU temp", vram: "GPU memory", down: "Download", up: "Upload", ping: "Ping", disk: "Disk use" };
export const SIZES = ["S", "M", "L"];
export const DEFAULT_GRAPHS = Object.freeze({ off: Object.freeze([]), size: Object.freeze({}), pin: Object.freeze([]) });
const keys = a => (Array.isArray(a) ? a : []).filter((k, i, all) => GRAPH_KEYS.includes(k) && all.indexOf(k) === i);

// Whatever was saved, cleaned: known keys once each, known sizes only.
export function normGraphs(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_GRAPHS;
  const size = Object.fromEntries(Object.entries(raw.size && typeof raw.size === "object" ? raw.size : {}).filter(([k, v]) => GRAPH_KEYS.includes(k) && SIZES.includes(v) && v !== "M"));
  const pin = keys(raw.pin);
  return { off: keys(raw.off).filter(k => !pin.includes(k)), size, pin };
}
// Graph keys the machine has now (graph history may be missing, then only what the reading shows).
export const graphsFor = (m, h) => GRAPH_KEYS.filter(k => !["gpu", "gtemp", "vram"].includes(k) || m.d?.[k] != null || (h?.[k] || []).some(p => p[1] > 0));
export const graphShown = (g, k) => g.pin.includes(k) || !g.off.includes(k);
export const sizeOf = (g, k) => g.size[k] || "M";
// The CSS classes a graph panel gets from its choices.
export const graphClass = (g, k) => `gs-${sizeOf(g, k).toLowerCase()}${g.pin.includes(k) ? " gpinned" : ""}`;
const flip = (list, k) => (list.includes(k) ? list.filter(x => x !== k) : [...list, k]);
export const toggleGraph = (g, k) => normGraphs({ ...g, off: flip(g.off, k) });
export const togglePinGraph = (g, k) => normGraphs({ ...g, pin: flip(g.pin, k) });
export const setGraphSize = (g, k, s) => normGraphs({ ...g, size: { ...g.size, [k]: s } });
