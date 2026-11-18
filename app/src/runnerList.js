import { dur, prOf } from "./format.js";
// The Runners tab's list and queue, as plain rows. Pure.
// d.runners { name: busy }, d.jobs { name: [workflow, _, ref, repo] }, started { name: when the job began }, gone [names that stopped reporting],
// d.queued [[label, waiting since]] (jobs waiting for one of this machine's runners; absent when the machine cannot tell).
export const STATUS_TEXT = { busy: "Working", idle: "Idle", gone: "Not reporting" };
// One row per runner: { name, status, job, inJob, size } sorted by name. `sizes` is { name: bytes | null } once asked for.
export function runnerRows(d, started = {}, gone = [], now, sizes = {}) {
  const rn = d?.runners || {}, jobs = d?.jobs || {}, names = [...Object.keys(rn), ...gone.filter(g => !(g in rn))].sort();
  return names.map(name => {
    const status = !(name in rn) ? "gone" : (name in jobs || rn[name]) ? "busy" : "idle", j = jobs[name];
    return { name, status, job: j ? [j[0] || "Running", prOf(j[2])].filter(Boolean).join(" ") : "", inJob: j && started[name] ? dur(now - started[name]) : "", size: name in sizes ? sizes[name] : undefined };
  });
}
// The waiting jobs, longest wait first: { label, waited }.
export const queueRows = (d, now) => (d?.queued || []).map(([label, since]) => ({ label, waited: dur(now - since), since })).sort((a, b) => a.since - b.since);
// A size in bytes as "3.4 GB", "812 MB", or "–" when it could not be measured.
export function bytesText(b) {
  if (b == null) return "–";
  return b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
}
