import { isWarn, hm, hotMin, WATCH, rate } from "./format.js";
// What the mini window shows for one machine (pure). Tiles: CPU, memory, then GPU when it has one (network speed when not), then temperature.
// Each has its metric key (the colour and the limit), a label, the text to show (and a small unit after it, for speeds), and the top of its sparkline scale (0 = scale to the data).
export const miniTiles = d => [
  { k: "cpu", label: "CPU", v: d.cpu, text: pct(d.cpu, "%"), max: 100 },
  { k: "ram", label: "Mem", v: d.ram, text: pct(d.ram, "%"), max: 100 },
  d.gpu != null ? { k: "gpu", label: "GPU", v: d.gpu, text: pct(d.gpu, "%"), max: 100 } : { k: "down", label: "Net", v: d.down, text: d.down == null ? "–" : rate(d.down)[0], unit: d.down == null ? "" : rate(d.down)[1], max: 0 },
  { k: "temp", label: "Temp", v: d.temp, text: pct(d.temp, "°"), max: 100 },
];
const pct = (v, u) => (v == null ? "–" : Math.round(v) + u);
// The alert chip text for a machine, or "" when nothing needs a look. `hotSince` is when its CPU went over the limit (ms) or undefined.
export function miniChip(m, limits, hotSince, lastOk, nowMs) {
  if (m.err) return "Offline" + (lastOk ? " since " + hm(lastOk) : "");
  if (hotSince) return `CPU high ${hotMin(hotSince, nowMs)} min`;
  const bad = WATCH.find(k => isWarn(k, (m.d || {})[k], limits));
  return !bad ? "" : bad === "cpu" ? "CPU is high" : "Running warm";
}
