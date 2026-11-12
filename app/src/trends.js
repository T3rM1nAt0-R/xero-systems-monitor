// Job duration trends from the finished-job rows [machine, runner, start, end, result, label]. Pure, so it is tested.
// The workflow name is the last part of the label: "PR #744 · branch · Fast check (example-repo)" -> "Fast check".
export const jobName = label => { const parts = String(label || "").split(" · "), n = (parts[parts.length - 1] || "").replace(/\s*\([^)]*\)\s*$/, "").trim(); return n || "Job"; };
const DAY = 86400;
export function jobTrends(rows, machine, nowSec) {
  const agg = {}, slow = [];
  for (const [m, runner, t0, t1, res, label] of rows) {
    if (m !== machine || t1 < nowSec - 14 * DAY) continue;
    const week = t1 >= nowSec - 7 * DAY, mins = (t1 - t0) / 60, e = (agg[jobName(label)] ||= { name: jobName(label), runs: 0, sum: 0, pruns: 0, psum: 0, failed: 0 });
    if (week) { e.runs++; e.sum += mins; if (res === "Failed") e.failed++; slow.push({ mins, label, runner, res, t: t1 }); } else { e.pruns++; e.psum += mins; }
  }
  const workflows = Object.values(agg).filter(e => e.runs).map(e => { const avg = e.sum / e.runs, prev = e.pruns ? e.psum / e.pruns : null;
    return { name: e.name, runs: e.runs, avg, prev, change: prev && e.pruns >= 2 && e.runs >= 2 ? (avg - prev) / prev : null, failed: e.failed, total: e.sum }; }).sort((a, b) => b.total - a.total).slice(0, 6);
  return { workflows, slow: slow.sort((a, b) => b.mins - a.mins).slice(0, 3) };
}
