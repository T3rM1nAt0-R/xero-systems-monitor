import tuning from "./unusual.json" with { type: "json" };
// "Unusual for this time": is a number far above what this machine usually does at this hour of the day? Pure.
// The tunables are in unusual.json: above_pct (how many points above normal counts), min_days (days of history needed),
// window_h (how many hours either side of now count as "the same hour"), min_now_pct (never flag a quiet machine).
export const UNUSUAL = tuning;
export const UNUSUAL_KEYS = ["cpu", "ram", "gpu"];
const DAY = 86400, HOUR = 3600, WEEK = 7 * DAY;
// The usual value at this time of day: the average, over the days before today, of the points within window_h of now's time of day.
// null when fewer than min_days days have any.
export function usualAt(pts, now, cfg = UNUSUAL) {
  const byDay = new Map();
  for (const [t, v] of pts || []) {
    const ago = now - t, off = ago % DAY, near = Math.min(off, DAY - off);
    if (ago < HOUR || ago > WEEK + cfg.window_h * HOUR || near > cfg.window_h * HOUR) continue;
    const d = Math.round(ago / DAY), e = byDay.get(d) || [0, 0];
    e[0] += v; e[1]++; byDay.set(d, e);
  }
  if (byDay.size < cfg.min_days) return null;
  const means = [...byDay.values()].map(([s, n]) => s / n);
  return means.reduce((a, b) => a + b, 0) / means.length;
}
// { usual } when `current` is far above the usual, else null.
export function unusualNow(current, pts, now, cfg = UNUSUAL) {
  if (current == null || current < cfg.min_now_pct) return null;
  const usual = usualAt(pts, now, cfg);
  return usual != null && current - usual >= cfg.above_pct ? { usual } : null;
}
