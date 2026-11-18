import { resultKind } from "./history.js";
// The three big numbers at the top of the Runners tab, for jobs that finished today (since midnight, local time). Pure: `now` is seconds.
// { jobs, success (whole percent, null when no jobs), median (seconds, null when no jobs) }
const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
// The colour of the "Succeeded" percent: at or above SUCCESS_GOOD is good, at or above SUCCESS_WARN needs a look, below is bad.
export const SUCCESS_GOOD = 90, SUCCESS_WARN = 75;
export const successTone = pct => (pct == null ? "" : pct >= SUCCESS_GOOD ? "good" : pct >= SUCCESS_WARN ? "warn" : "bad");
export function runnerStats(rows, machine, now) {
  const d = new Date(now * 1000); d.setHours(0, 0, 0, 0);
  const today = rows.filter(r => r[0] === machine && r[3] >= d.getTime() / 1000);
  if (!today.length) return { jobs: 0, success: null, median: null };
  const ok = today.filter(r => resultKind(r[4]) === "succeeded").length;
  return { jobs: today.length, success: Math.round((ok / today.length) * 100), median: median(today.map(r => r[3] - r[2])) };
}
