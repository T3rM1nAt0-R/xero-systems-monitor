// Quiet hours and muted alerts. Pure: the window keeps the settings, these decide what to hold back.
export const DEFAULT_QUIET = { on: false, from: "23:00", to: "08:00" };   // 11 PM to 8 AM
export const NEVER_HELD = "offline";   // a machine going offline is the one pop-up quiet hours do not hold
export const KIND_NAME = { offline: "Machine offline", failed: "Job failed", runner: "Runner stopped", hot: "CPU high", svc: "Container or service failed", disk: "Disk nearly full" };

const minutes = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
// "23:00" -> "11:00 PM"
export function timeLabel(t) {
  const m = minutes(t); if (m == null) return "";
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
// Every half hour of the day, for the From / To pickers: [["00:00", "12:00 AM"], ...]
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => { const t = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`; return [t, timeLabel(t)]; });

// Is `date` inside the quiet window? The window may cross midnight (11 PM to 8 AM). From equal to To means never quiet.
export function isQuiet(q, date = new Date()) {
  const a = minutes(q?.from), b = minutes(q?.to);
  if (!q?.on || a == null || b == null || a === b) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return a < b ? now >= a && now < b : now >= a || now < b;
}
// Should this kind of pop-up be held right now?
export const isHeld = (q, kind, date = new Date()) => kind !== NEVER_HELD && isQuiet(q, date);

// Muted alerts: a list of { machine, kind }.
export const isMuted = (list, machine, kind) => (list || []).some(x => x.machine === machine && x.kind === kind);
export const mute = (list, machine, kind) => isMuted(list, machine, kind) ? list : [...(list || []), { machine, kind }];
export const unmute = (list, machine, kind) => (list || []).filter(x => !(x.machine === machine && x.kind === kind));
export const muteLabel = ({ machine, kind }) => `${KIND_NAME[kind] || kind} · ${machine}`;
