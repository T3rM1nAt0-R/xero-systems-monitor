// One lane per runner: bars from the collector's finished-job rows plus the jobs running now.
// A row is [machine, runner, start, end, result, label] (seconds).
export const BAD = { Failed: "bad", Canceled: "stop", Cancelled: "stop", Abandoned: "stop" };
export function buildLanes(rows, machine, runners, jobs, started, t0, t1) {
  const L = {}; const get = r => (L[r] ||= []);
  for (const [m, r, s, e, res, label] of rows) if (m === machine && e >= t0) get(r).push({ s, e, label, ...(res && { res }) });
  for (const r of Object.keys(runners || {})) get(r);
  for (const r of Object.keys(jobs || {})) get(r).push({ s: started?.[r] || t1 - 60, e: t1, label: jobs[r][0], run: true });
  return Object.entries(L).filter(([, bars]) => bars.some(b => b.e >= t0)).sort((a, b) => a[0].localeCompare(b[0]));   // idle runners with nothing in this period are left out
}
