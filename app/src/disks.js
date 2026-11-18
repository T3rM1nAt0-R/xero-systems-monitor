import { NONE } from "./consts.js";
// The facts behind the Disks tab, as plain functions (no React): drive speeds from the history, drive health wording, and the biggest-folders search.
export const SCAN_POLL_MS = 600;   // how often a running search is asked how far it is
export const HEALTH_NOTES = {
  missing: "Install smartmontools to see drive health.",
  denied: "Drive health could not be read: the drives need more access than this account has.",
};
// Drives that have a speed, in the order the machine lists them: the live ones first, then any only the history knows.
export function ioDrives(d, h) {
  const live = (d.io || []).map(r => r[0]), past = Object.keys(h?.extra || {}).filter(k => k.startsWith("dr:")).map(k => k.slice(3));
  return [...new Set([...live, ...past])];
}
export const ioPts = (h, kind, name) => h?.extra?.[kind + ":" + name] || NONE;   // kind: "dr" (read) or "dw" (write)
export const ioNow = (d, name) => (d.io || []).find(r => r[0] === name)?.slice(1) || null;   // [read, write] bytes per second
export const hoursText = n => (n >= 8760 ? `${(n / 8760).toFixed(1)} years` : n >= 48 ? `${Math.round(n / 24)} days` : `${n} hours`);
// One line of drive health per drive: { name, model, ok, facts: ["34°C", "powered on 1.2 years", "3% worn"] }.
export const healthRows = d => (d.smart || []).map(([name, model, ok, temp, hours, wear]) => ({
  name: String(name).replace(/_/g, " "), model: String(model || "").replace(/_/g, " "), ok,
  facts: [temp != null && `${Math.round(temp)}°C`, hours != null && `powered on ${hoursText(hours)}`, wear != null && `${Math.round(wear)}% worn`].filter(Boolean), wear,
}));
export const healthNote = d => (d.smart?.length ? "" : HEALTH_NOTES[d.smart_note] || "");
export function sizeStr(bytes) {
  for (const [u, f] of [["TB", 2 ** 40], ["GB", 2 ** 30], ["MB", 2 ** 20]]) if (bytes >= f) return (bytes / f).toFixed(bytes < 10 * f ? 1 : 0) + " " + u;
  return Math.max(0, Math.round(bytes / 1024)) + " KB";
}
// What the biggest-folders box shows for a reply of get_big_folders (null = nothing started yet).
export function scanView(reply) {
  if (!reply) return { phase: "idle" };
  if (reply.state === "running") return { phase: "running", seen: reply.seen || 0 };
  if (reply.state === "done") { const top = Math.max(1, ...reply.folders.map(f => f.bytes)); return { phase: "done", rows: reply.folders.map(f => ({ ...f, size: sizeStr(f.bytes), pct: Math.max(2, Math.round(100 * f.bytes / top)) })) }; }
  if (reply.state === "cancelled") return { phase: "cancelled" };
  return { phase: "failed", error: reply.error || "That did not work." };
}
