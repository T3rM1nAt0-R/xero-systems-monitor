// The tray icon's colour and hover text. Pure: the window decides the status, the shell only draws it.
//   bad  (red):   a machine is offline, a container or service is failing, or a job failed that you have not seen yet
//   look (amber): CPU, temperature, memory or disk is over its limit
//   calm (green): none of that
import { isWarn } from "./format.js";
import { containerBad } from "./alerts.js";
import { limitsFor } from "./limits.js";

export function machineStatus(m, limits) {
  if (m.err) return "bad";
  const d = m.d || {};
  if ((d.docker || []).some(containerBad) || (d.failed || []).length > 0) return "bad";
  const l = limitsFor(limits, m.name);
  if (["cpu", "temp", "gtemp", "ram", "vram"].some(k => isWarn(k, d[k], l)) || (d.disk != null && d.disk >= l.disk)) return "look";
  return "calm";
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// machines: the snapshots; limits: the saved per-machine limits; failedJobs: failures not seen yet.
export function trayStatus(machines, limits, failedJobs = 0) {
  const all = machines.map(m => machineStatus(m, limits)), count = s => all.filter(x => x === s).length;
  const calm = count("calm"), look = count("look"), bad = count("bad");
  const state = bad || failedJobs > 0 ? "bad" : look ? "look" : "calm";
  const parts = [];
  if (calm) parts.push(`${calm} calm`);
  if (look) parts.push(`${look} ${look === 1 ? "needs" : "need"} a look`);
  if (bad) parts.push(`${bad} down or failing`);
  if (failedJobs > 0) parts.push(plural(failedJobs, "failed job", "failed jobs"));
  const first = machines.find(m => !m.err && m.d?.cpu != null);
  const text = ["Xero Systems Monitor", parts.join(", "), first ? `CPU ${Math.round(first.d.cpu)}%` : ""].filter(Boolean).join(" · ");
  return { state, tooltip: text };
}
