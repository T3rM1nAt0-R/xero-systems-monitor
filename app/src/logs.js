// Reading the recent system log. Pure (no React): the Logs tab and the tests use it.
// The shell sends back journalctl's short-iso lines on Linux, or PowerShell's JSON events (Time, LogName, ProviderName, Level, Message) on Windows.

export const LOGS_EVERY_MS = 10e3;   // the auto-refresh switch looks again this often
export const PRIORITIES = [["errors", "Errors"], ["warnings", "Warnings"], ["all", "All"]];

// "2026-11-18T09:12:01+0000 host ssh[812]: message" -> { t (ms), unit, msg, level }. Lines that are not log lines (journalctl's "-- Boot --") are dropped.
const LINE = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?)([+-]\d\d):?(\d\d)\s+\S+\s+([^\s:[]+)(?:\[\d+\])?:\s?(.*)$/;
export function parseJournal(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const m = LINE.exec(line.trim());
    if (m) out.push({ t: Date.parse(`${m[1]}${m[2]}:${m[3]}`), unit: m[4], msg: m[5], level: "" });
  }
  return out.reverse();   // newest first
}
export function parseEvents(text) {
  let rows;
  try { rows = JSON.parse(text); } catch { return []; }
  return [].concat(rows || []).filter(r => r && r.Time).map(r => ({ t: Date.parse(r.Time), unit: String(r.ProviderName || r.LogName || ""), msg: String(r.Message || ""), level: String(r.Level || "").toLowerCase() })).sort((a, b) => b.t - a.t);
}
// Either kind of answer: JSON starts with [ or {, journalctl's lines do not.
export const parseLog = text => (/^\s*[[{]/.test(String(text || "")) ? parseEvents(text) : parseJournal(text));

// Rows that contain every word typed in the search box (any case), in the message or the unit.
export function searchLog(rows, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? rows.filter(r => words.every(w => (r.msg + " " + r.unit).toLowerCase().includes(w))) : rows;
}
// "Nov 18, 9:12:01 AM": 12-hour, with seconds.
export const logTime = ms => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
