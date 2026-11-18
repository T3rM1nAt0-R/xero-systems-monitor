// The compact numbers under the CPU graphs, from the optional LibreHardwareMonitor fields of a reading.
// Returns [label, text] pairs for what is known; empty when LibreHardwareMonitor is not running.
export function hwNumbers(d) {
  const out = [];
  if (d.mhz != null) out.push(["Clock", d.mhz >= 1000 ? `${(d.mhz / 1000).toFixed(2)} GHz` : `${Math.round(d.mhz)} MHz`]);
  if (d.cpu_w != null) out.push(["CPU power", `${d.cpu_w.toFixed(0)} W`]);
  if (d.gpu_w != null) out.push(["GPU power", `${d.gpu_w.toFixed(0)} W`]);
  if (d.fans?.length) out.push([d.fans.length > 1 ? "Fans" : "Fan", d.fans.map(r => Math.round(r)).join(" · ") + " RPM"]);
  return out;
}
// Height in percent of each thin core bar (a core that is idle still shows a sliver).
export const coreBars = cores => (cores || []).map(c => Math.max(4, Math.min(100, c)));
// One row per CPU core: its load and its temperature, whichever of them this machine reports. Empty when it reports neither.
export function coreRows(d) {
  const n = Math.max(d?.cores?.length || 0, d?.ctemps?.length || 0);
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, load: d.cores?.[i] ?? null, temp: d.ctemps?.[i] ?? null }));
}
// "1 h 35 min", "45 min".
export const minutesText = m => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
// The battery of a reading d.bat = [charge %, plugged in, minutes left or null], in plain words; null when there is no battery.
export function batteryFacts(bat) {
  if (!bat) return null;
  const [pct, plugged, min] = bat, full = plugged && pct >= 99;
  const state = full ? "Fully charged" : plugged ? "Charging" : "On battery";
  const left = min != null && !full ? `${minutesText(min)} ${plugged ? "until full" : "left"}` : "";
  const level = !plugged && pct <= 10 ? "crit" : !plugged && pct <= 20 ? "warn" : "";
  return { pct, state, left, level, text: `${Math.round(pct)}%` };
}
// Video memory text: "5.0 GB", "800 MB", and "in use" when the driver does not say how much (0).
export const vramText = mb => (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : mb > 0 ? Math.round(mb) + " MB" : "in use");
// Programs using the graphics card, biggest memory first: [{ name, mb, count, share }] with share 0 to 100 of the biggest.
export function gpuAppRows(apps) {
  const list = [...(apps || [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), top = Math.max(1, ...list.map(a => a[1]));
  return list.map(([name, mb, count]) => ({ name: name.replace(/_/g, " "), mb, count, share: Math.round(100 * mb / top) }));
}
// Board, system and similar names that mean "the maker left this blank".
const GENERIC = /^(system product name|to be filled|default string|not specified|unknown|none|o\.?e\.?m)/i;
// The machine's hardware names as [label, text] pairs (CPU, graphics, board, system, memory), without placeholder names.
export function hwFacts(d) {
  const hw = d?.hw || {}, board = GENERIC.test(hw.board || "") ? "" : hw.board;
  return [["CPU", hw.cpu], ["Graphics", hw.gpu], ["Board", board], ["System", hw.os], ["Memory", d?.ram_gb ? `${d.ram_gb[1].toFixed(0)} GB` : ""]].filter(p => p[1]);
}
