import { hm } from "./format.js";
// Small markers on a machine's graphs for things that happened: restarts, jobs, container restarts, going offline and back.
// Pure: takes the Activity events [t, machine, text], the finished-job rows [machine, runner, start, end, result, label] and the uptime.
export const MARK_MAX = 60;   // a graph never gets more markers than this, newest kept
// What an Activity event text means for the graph markers, or "" for nothing.
export function markKind(text) {
  const t = String(text || "");
  if (/went offline/.test(t)) return "offline";
  if (/back online/.test(t)) return "online";
  if (/keeps restarting|container .* restart/.test(t)) return "container";
  if (/machine restarted|rebooted/.test(t)) return "restart";
  return "";
}
const isFail = res => /^fail/i.test(res || "");
// Every marker for one machine inside [t0, t1], oldest first: { t, kind, text } where text starts with the 12-hour time.
// kind: restart | offline | online | container | job | fail
export function autoMarks({ events = [], rows = [], machine, uptime, now, t0, t1 = now }) {
  const out = [];
  for (const [t, who, text] of events) { const kind = who === machine ? markKind(text) : ""; if (kind) out.push({ t, kind, text: String(text) }); }
  if (uptime != null && now - uptime > 0) out.push({ t: now - uptime, kind: "restart", text: "Machine restarted" });
  for (const [who, runner, a, b, res, label] of rows) {
    if (who !== machine) continue;
    out.push({ t: a, kind: "job", text: `${runner} started: ${label}` });
    out.push({ t: b, kind: isFail(res) ? "fail" : "job", text: `${runner} ${isFail(res) ? "failed" : "finished"}: ${label}` });
  }
  const seen = new Set();
  return out.filter(x => { const id = x.kind + Math.round(x.t / 60) + x.text; return x.t >= t0 && x.t <= t1 && !seen.has(id) && seen.add(id); })
    .sort((a, b) => a.t - b.t).slice(-MARK_MAX).map(x => ({ ...x, text: `${hm(x.t)} · ${x.text}` }));
}
