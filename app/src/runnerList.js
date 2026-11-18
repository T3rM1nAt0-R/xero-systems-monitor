import { dur, prOf } from "./format.js";
import { resultKind } from "./history.js";
const lastJob = (finished, machine, runner) => finished.reduce((best, r) => (r[0] === machine && r[1] === runner && (!best || r[3] > best[3]) ? r : best), null);
// The Runners tab's list and queue, as plain rows. Pure.
// d.runners { name: busy }, d.jobs { name: [workflow, _, ref, repo] }, started { name: when the job began }, gone [names that stopped reporting],
// d.queued [[label, waiting since]] (jobs waiting for one of this machine's runners; absent when the machine cannot tell).
export const STATUS_TEXT = { busy: "Working", idle: "Idle", gone: "Not reporting" };
// "a moment", "22 min", "3 h" or "2 d": how long ago, for a gap in seconds.
export function agoText(s) {
  s = Math.max(0, s);
  return s < 90 ? "a moment" : s < 5400 ? Math.round(s / 60) + " min" : s < 129600 ? Math.round(s / 3600) + " h" : Math.round(s / 86400) + " d";
}
// One row per runner: { name, status, job, inJob, size, last, note } sorted by name. `sizes` is { name: bytes | null } once asked for.
// `finished` are the collector's finished-job rows [machine, runner, start, end, result, label]; `last` is the runner's newest one ({ res, kind, label, ago }, or null).
// `note` is the status line: "Working", "Idle · last job 22 min ago", "Not reporting".
export function runnerRows(d, started = {}, gone = [], now, sizes = {}, finished = [], machine) {
  const rn = d?.runners || {}, jobs = d?.jobs || {}, names = [...Object.keys(rn), ...gone.filter(g => !(g in rn))].sort();
  return names.map(name => {
    const status = !(name in rn) ? "gone" : (name in jobs || rn[name]) ? "busy" : "idle", j = jobs[name];
    const l = lastJob(finished, machine, name), last = l ? { res: l[4] || "Unknown", kind: resultKind(l[4]), label: l[5], ago: agoText(now - l[3]) } : null;
    return { name, status, job: j ? [j[0] || "Running", prOf(j[2])].filter(Boolean).join(" ") : "", inJob: j && started[name] ? dur(now - started[name]) : "", size: name in sizes ? sizes[name] : undefined, last,
      note: status === "idle" ? "Idle" + (last ? ` · last job ${last.ago} ago` : "") : STATUS_TEXT[status] };
  });
}
// The waiting jobs, longest wait first: { label, waited }.
export const queueRows = (d, now) => (d?.queued || []).map(([label, since]) => ({ label, waited: dur(now - since), since })).sort((a, b) => a.since - b.since);
// A size in bytes as "3.4 GB", "812 MB", or "–" when it could not be measured.
export function bytesText(b) {
  if (b == null) return "–";
  return b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
}
