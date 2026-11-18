import { SECTION_META, TABS, svcFacts } from "./meta.js";
import { hwNumbers, coreBars, hwFacts } from "../hwStrip.js";
// Which slice of each section a tab shows. Pure (no React): the tab row, the Overview and the tests all read it.
// A "part" is [section id, view]. The view tells the section's component what to draw: "full" is everything it has,
// anything else is one slice of it (see Cpu.jsx, Net.jsx, Disk.jsx, Runners.jsx, Services.jsx).
// To add a tab (Logs, Terminal): give it parts here and a component for the view; with no parts it simply does not show yet.
export const FULL = "full";
export const TAB_PARTS = {
  overview: [["cpu", "graphs"], ["gpu", "graphs"], ["net", "graphs"], ["disk", "graphs"], ["run", "compact"], ["svc", "failing"]],
  hardware: [["cpu", "hardware"]],
  processes: [["cpu", "processes"]],
  disks: [["disk", FULL]],
  network: [["net", FULL]],
  services: [["svc", FULL]],
  runners: [["run", FULL]],
  logs: [],
  terminal: [],
};
// Does this view of a section have anything to show for this machine? (Parts not listed here always do, once the section itself is there.)
const HAS = {
  "cpu.hardware": m => hwFacts(m.d).length > 0 || hwNumbers(m.d || {}).length > 0 || coreBars(m.d?.cores).length > 0,
  "cpu.processes": m => (m.d?.top?.length || 0) > 0,
  "svc.failing": m => { const f = svcFacts(m); return f.bad > 0 || !!m.d?.docker_err; },
};
// Should this slice of this section be drawn (a "full" view shows whenever the section is there)?
export const partShown = (id, view, m, h) => !!SECTION_META.find(s => s.id === id)?.available(m, h) && (view === FULL || (HAS[id + "." + view]?.(m, h) ?? true));
// Does a view include this slice? "full" includes all of them.
export const hasView = (view, slice) => view === FULL || view === slice;
// What Overview shows: each section's small slice, or the whole section when it is pinned. Sections come in their default order.
export function overviewParts(m, h, pinned = []) {
  const small = Object.fromEntries(TAB_PARTS.overview);
  return SECTION_META.flatMap(s => { const v = pinned.includes(s.id) ? FULL : small[s.id]; return v && partShown(s.id, v, m, h) ? [[s.id, v]] : []; });
}
// What a tab shows right now, as [section id, view] pairs.
export const tabParts = (tab, m, h, pinned = []) => tab === "overview" ? overviewParts(m, h, pinned) : (TAB_PARTS[tab] || []).filter(([id, v]) => partShown(id, v, m, h));
// The tabs worth showing for this machine now ([id, title] pairs): Overview always, the others only with content.
export const availableTabs = (m, h) => TABS.filter(([id]) => id === "overview" || tabParts(id, m, h).length > 0);
// The tab to draw: the remembered one if this machine still has it, else Overview.
export const effectiveTab = (tab, m, h) => availableTabs(m, h).some(t => t[0] === tab) ? tab : "overview";
// The tab an arrow key moves to (Left/Right wrap round; Home and End go to the ends); any other key keeps `tab`.
export function stepTab(tabs, tab, key) {
  const ids = tabs.map(t => t[0]), i = ids.indexOf(tab);
  if (!ids.length) return tab;
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  const step = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (!step) return tab;
  return i < 0 ? ids[0] : ids[(i + step + ids.length) % ids.length];
}
