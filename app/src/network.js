// The facts behind the Network tab, as plain functions (no React): adapters and Wi-Fi, the internet check strip and the ping map.
export const DAY_S = 86400, STRIP_BUCKET_S = 900;   // the up/down strip covers 24 h in 15-minute cells
export const SLOW_MS = 100, VERY_SLOW_MS = 250;     // a reply slower than this is shown amber, then red
export const DEFAULT_HOST = "https://www.gstatic.com/generate_204";
export const speedText = mbps => (mbps >= 1000 ? `${mbps / 1000} Gbps` : mbps > 0 ? `${mbps} Mbps` : "");
// Adapters as { name, up, speed, ip } rows: the ones that are up first.
export const adapterRows = d => [...(d.adapters || [])].map(([name, up, speed, ip]) => ({ name, up, speed: speedText(speed), ip: ip || "" })).sort((a, b) => b.up - a.up || a.name.localeCompare(b.name));
export const wifiBars = pct => (pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : 1);
// "ok" | "slow" | "bad" | "down" for a ping time (null = no answer).
export const latencyClass = ms => (ms == null ? "down" : ms >= VERY_SLOW_MS ? "bad" : ms >= SLOW_MS ? "slow" : "ok");
export const msText = ms => (ms == null ? "no answer" : ms < 10 ? ms.toFixed(1) + " ms" : Math.round(ms) + " ms");
// d.inet = [up, dns_ms, total_ms] -> { up, dns, ms } (null before the first check).
export const internetNow = d => (d.inet ? { up: d.inet[0], dns: d.inet[1], ms: d.inet[2] } : null);
// The last 24 h of the check as cells, oldest first: "none" (no data), "up", "part" (some failed), "down".
export function stripCells(pts, now, bucket = STRIP_BUCKET_S, span = DAY_S) {
  const n = Math.ceil(span / bucket), start = Math.floor(now / bucket) * bucket - (n - 1) * bucket, sums = Array.from({ length: n }, () => [0, 0]);
  for (const [t, v] of pts || []) { const i = Math.floor((t - start) / bucket); if (i >= 0 && i < n) { sums[i][0] += v; sums[i][1]++; } }
  return sums.map(([s, c], i) => ({ t: start + i * bucket, state: !c ? "none" : s / c >= 1 ? "up" : s / c <= 0 ? "down" : "part" }));
}
// Uptime share of the strip, as a percent text ("100%"), or "" with no data.
export function uptimeText(cells) {
  const seen = cells.filter(c => c.state !== "none");
  return seen.length ? Math.round(100 * seen.filter(c => c.state === "up").length / seen.length) + "%" : "";
}
// Ping rows { name, ms, cls, text } of the machines this PC pings, slowest first among the answers, unanswered last.
export const pingRows = d => (d.pings || []).map(([name, ms]) => ({ name, ms, cls: latencyClass(ms), text: msText(ms) })).sort((a, b) => (a.ms == null) - (b.ms == null) || b.ms - a.ms);
// Only a plain https:// address is accepted for the check.
export const hostOk = s => /^https:\/\/[^\s"]+$/.test(String(s || "").trim());
