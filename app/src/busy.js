// Busy-time heatmap for the Runners group. Pure, so it is tested.
// The week heatmap: one row per local day (today last), 24 hourly cells. A cell is the share of runner time busy in that hour
// (jobs overlapping it / (runners x the part of the hour that has happened)), plus the jobs that touched that hour and how many failed.
// Jobs are [start, end, result]; running jobs are start times. A day's own totals count each job once, on the day it began.
export const hour12 = h => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const HEAT_AXIS = [0, 6, 12, 18];
const at = (d0, k, h) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - k, h).getTime() / 1000;
export function busyHeat(rows, machine, runnerCount, running, now, days = 7) {
  const jobs = rows.filter(r => r[0] === machine).map(r => [r[2], r[3], r[4]]).concat(running.map(t => [t, now, "running"]));
  const d0 = new Date(now * 1000), out = [];
  for (let k = days - 1; k >= 0; k--) {
    const a = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - k), ds = at(d0, k, 0), de = at(d0, k, 24);
    const cells = [];
    for (let h = 0; h < 24; h++) {
      const s = at(d0, k, h), e = Math.min(at(d0, k, h + 1), now);
      if (e <= s) { cells.push({ h, pct: null, jobs: 0, failed: 0 }); continue; }
      let busy = 0, n = 0, failed = 0;
      for (const [js, je, res] of jobs) { const o = Math.min(je, e) - Math.max(js, s); if (o > 0) { busy += o; n++; if (res === "Failed") failed++; } }
      cells.push({ h, pct: runnerCount > 0 ? Math.min(100, (100 * busy) / (runnerCount * (e - s))) : 0, jobs: n, failed });
    }
    const began = jobs.filter(([js]) => js >= ds && js < de);
    out.push({ day: a.toLocaleDateString("en-US", { weekday: "short" }), date: a.toLocaleDateString("en-US", { day: "numeric", month: "short" }), today: k === 0, cells, jobs: began.length, failed: began.filter(j => j[2] === "Failed").length });
  }
  return out;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
export const heatTip = (day, c) => c.pct == null ? `${day.day} ${hour12(c.h)} · not yet`
  : `${day.day} ${hour12(c.h)} · ${Math.round(c.pct)}% busy · ${c.jobs ? plural(c.jobs, "job") + (c.failed ? `, ${c.failed} failed` : "") : "no jobs"}`;
export const dayLine = d => `${d.jobs ? plural(d.jobs, "job") : "no jobs"}${d.failed ? `, ${d.failed} failed` : ""}`;
