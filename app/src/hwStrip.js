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
// Board, system and similar names that mean "the maker left this blank".
const GENERIC = /^(system product name|to be filled|default string|not specified|unknown|none|o\.?e\.?m)/i;
// The machine's hardware names as [label, text] pairs (CPU, graphics, board, system, memory), without placeholder names.
export function hwFacts(d) {
  const hw = d?.hw || {}, board = GENERIC.test(hw.board || "") ? "" : hw.board;
  return [["CPU", hw.cpu], ["Graphics", hw.gpu], ["Board", board], ["System", hw.os], ["Memory", d?.ram_gb ? `${d.ram_gb[1].toFixed(0)} GB` : ""]].filter(p => p[1]);
}
