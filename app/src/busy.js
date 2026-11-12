// How busy the runners of one machine were, per local day: busy seconds / (runners x seconds of that day so far).
export function busyByDay(rows, machine, runnerCount, running, now, days = 7) {
  const d0 = new Date(now * 1000); d0.setHours(0, 0, 0, 0);
  const out = [];
  for (let k = days - 1; k >= 0; k--) {
    const a = new Date(d0); a.setDate(a.getDate() - k); const b = new Date(a); b.setDate(b.getDate() + 1);
    const s = a.getTime() / 1000, e = Math.min(b.getTime() / 1000, now);
    let busy = 0;
    for (const [m, , rs, re] of rows) if (m === machine) busy += Math.max(0, Math.min(re, e) - Math.max(rs, s));
    for (const t of running) busy += Math.max(0, e - Math.max(t, s));   // jobs running now
    const pct = runnerCount > 0 && e > s ? Math.min(100, (100 * busy) / (runnerCount * (e - s))) : 0;
    out.push({ day: a.toLocaleDateString("en-US", { weekday: "short" }), date: a.toLocaleDateString("en-US", { day: "numeric", month: "short" }), pct, today: k === 0 });
  }
  return out;
}
