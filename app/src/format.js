export function rate(b) {
  for (const [u, f] of [["GB/s", 1e9], ["MB/s", 1e6], ["KB/s", 1e3]]) if (b >= f) return [b < 100 * f ? (b / f).toFixed(1) : (b / f).toFixed(0), u];
  return [b.toFixed(0), "B/s"];
}
export const rateStr = b => rate(b).join(" ");
export const gb = x => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
export function uptime(s) { return s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} m`; }
export function dur(s) { s = Math.max(0, Math.floor(s)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`; }
export const prOf = ref => { const m = /refs\/pull\/(\d+)/.exec(ref || ""); return m ? "#" + m[1] : ""; };
// Times are always 12-hour with AM / PM ("3:05 PM"), whatever the PC's region is set to.
const T12 = { hour: "numeric", minute: "2-digit", hour12: true };
export const hm = t => new Date(t * 1000).toLocaleTimeString("en-US", T12);
export const hms = t => new Date(t * 1000).toLocaleTimeString("en-US", { ...T12, second: "2-digit" });
export const dayHm = t => new Date(t * 1000).toLocaleString("en-US", { ...T12, day: "numeric", month: "short" });
export const when = (t, range) => range > 86400 * 2 ? new Date(t * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short" }) + (range <= 86400 * 8 ? " " + hm(t) : "") : hm(t);
// Axis ticks at round clock times (15 min, 30 min, 1 h, ...): about 2 to 4 of them inside [t0, t1], in seconds.
const STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800, 1209600, 2592000];
export function axisTicks(t0, t1, max = 4) {   // `max`: how many labels fit (narrow graphs get fewer)
  const span = t1 - t0, step = STEPS.find(s => span / s <= max) || STEPS[STEPS.length - 1];
  const off = -new Date(t0 * 1000).getTimezoneOffset() * 60;   // keep ticks on local clock marks
  const out = []; for (let t = Math.ceil((t0 + off) / step) * step - off; t < t1; t += step) if (t - t0 > span * .07 && t1 - t > span * .09) out.push(t);   // not on top of the "now" label
  return out;
}
export const avg = a => (a.length ? a.reduce((x, y) => x + y[1], 0) / a.length : 0);
export const peak = a => a.reduce((m, p) => Math.max(m, p[1]), 0);
// Limits that turn something amber: the only time colour means "look at this".
export const LIM = { cpu: 90, temp: 80, gtemp: 80, ram: 90, vram: 95 };
export const TAG = { cpu: "HIGH", temp: "WARM", gtemp: "WARM", ram: "HIGH", vram: "HIGH" };
export const isWarn = (k, v) => v != null && LIM[k] != null && v >= LIM[k];

// Minutes the CPU has been "working hard". hotSince and nowMs are both milliseconds.
export const hotMin = (hotSince, nowMs) => Math.max(1, Math.round((nowMs - hotSince) / 60000));
export const WATCH = ["cpu", "temp", "gtemp"]; // the only metrics that mean "needs a look"

// "5 min", "2 h", "3 d": how long ago a unix time (seconds) was
export const since = t => { const s = Math.max(0, Date.now() / 1000 - t); return s < 90 ? "a moment" : s < 5400 ? Math.round(s / 60) + " min" : s < 129600 ? Math.round(s / 3600) + " h" : Math.round(s / 86400) + " d"; };
