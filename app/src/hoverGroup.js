// Graphs of one machine hover together: moving over any of them draws the same moment on all of them, and one tooltip
// lists every graph's value at that moment plus the jobs that were running then.
// A graph joins with { title, color, el() -> DOM node, value(t) -> text|null, mark(t|null) }. Detail.jsx supplies jobsAt(t) -> [text].
import { showTip, hideTip } from "./tooltip.js";
import { hms, when } from "./format.js";
const groups = new Map();
const get = g => { let v = groups.get(g); if (!v) groups.set(g, v = { members: new Map(), jobsAt: null }); return v; };
export function join(group, id, member) { const g = get(group); g.members.set(id, member); return () => { g.members.delete(id); }; }
export function setJobsAt(group, fn) { get(group).jobsAt = fn; return () => { const g = get(group); if (g.jobsAt === fn) g.jobsAt = null; }; }
export function hoverAt(group, t, x, y, range) {
  const g = get(group), lines = [{ t: (range > 86400 ? when(t, range) + " " : "") + hms(t), dim: true }];
  const order = [...g.members.values()].sort((a, b) => { const x = a.el(), y = b.el(); return !x || !y ? 0 : x.compareDocumentPosition(y) & 4 ? -1 : 1; });   // top to bottom, as on screen
  for (const m of order) {
    m.mark(t); const v = m.value(t);
    if (v != null) lines.push({ t: `${m.title} ${v}`, color: m.color });
  }
  const jobs = g.jobsAt ? g.jobsAt(t) : [];
  if (jobs.length) { lines.push({ t: "Running then", dim: true }); jobs.slice(0, 6).forEach(j => lines.push({ t: j })); if (jobs.length > 6) lines.push({ t: `+${jobs.length - 6} more`, dim: true }); }
  showTip(x, y, lines);
}
export function hoverEnd(group) { for (const m of get(group).members.values()) m.mark(null); hideTip(); }
