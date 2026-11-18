// The stand-in for the Tauri shell when the window runs in a plain browser. `handle(command, args)` answers every command in docs/window-api.md with demo data of the documented shape.
import { createShell } from "./fakeShell.js";
import { validSessionId } from "./terminal.js";
import { demoMachine, demoEvents, finishedJobs, forecast, history, busyAt, busiest } from "./fakeData.js";

const FIRST = [{ name: "This PC", kind: "local" }, { name: "example-server", kind: "ssh", host: "192.0.2.10", runner: true }];
const store = { machines: FIRST.map(m => ({ ...m })), prefs: { closeToTray: true, login: false, updates: true }, mode: "full", pinned: true };
const clock = () => Date.now() / 1000;
const ok = async () => null;
const named = n => store.machines.find(m => m.name === n);

// Mirrors the shell's check: unique names, no "|", and a host for every ssh machine. Returns an error text or "".
export function checkMachines(list) {
  if (!Array.isArray(list) || !list.length) return "Add at least one machine.";
  const seen = new Set();
  for (const m of list) {
    const n = String(m.name || "").trim();
    if (!n || n.includes("|")) return "Every machine needs a name (no | in it).";
    if (seen.has(n)) return `Two machines are called ${n}.`;
    if (m.kind !== "local" && !String(m.host || "").trim()) return `${n} needs a host.`;
    seen.add(n);
  }
  return "";
}

// The biggest-folders demo: a search "runs" for a couple of seconds, then lists made-up folders. Mirrors the real backend's replies.
const SCAN_MS = 2500, scans = new Map();
const DEMO_FOLDERS = [["media", 92], ["games", 61], ["projects", 34], ["downloads", 18], ["backups", 15], ["cache", 9], ["photos", 7], ["music", 5]];
const scanState = (s, now) => s.stopped ? { state: "cancelled" } : now - s.at < SCAN_MS ? { state: "running", seen: Math.round((now - s.at) * 42) } : { state: "done", folders: DEMO_FOLDERS.map(([n, g]) => ({ path: `${s.path.replace(/[\\/]+$/, "")}/${n}`, bytes: g * 2 ** 30 })) };
// Pushed events (the real shell sends these through Tauri): api.js listens here when there is no Tauri.
const listeners = new Map(), shells = new Map();
export const onFakeEvent = (name, fn) => { const set = listeners.get(name) || listeners.set(name, new Set()).get(name); set.add(fn); return () => set.delete(fn); };
const push = (name, payload) => { for (const fn of listeners.get(name) || []) fn(payload); };

const commands = {
  terminal_open: ({ id, machine }) => {
    if (!validSessionId(id) || !named(machine) || shells.has(id)) throw new Error("Cannot open that terminal.");
    const sh = createShell(machine, data => push("terminal-output", { id, data }));
    shells.set(id, sh);
    setTimeout(() => sh.start(), 700);   // a real shell or ssh takes a moment to answer
    return null;
  },
  terminal_write: ({ id, data }) => { shells.get(id)?.input(String(data)); return null; },
  terminal_resize: () => null,
  terminal_close: ({ id }) => { shells.delete(id); return null; },
  get_state: () => ({ machines: store.machines.filter(m => !m.paused).map(m => demoMachine(m, clock())) }),
  get_history: ({ machine, range }) => (named(machine) ? history(named(machine), range, clock()) : {}),
  get_busy_at: ({ machine, t }) => (named(machine) ? busyAt(named(machine), t) : {}),
  get_busiest: ({ machine, range }) => (named(machine) ? busiest(named(machine), range, clock()) : { minutes: 0, top: [] }),
  end_task: ({ machine, pid, name }) => {
    if (!named(machine)) throw new Error("That machine is not in the list.");
    if (!(pid >= 2)) throw new Error("That is part of the system and cannot be ended here.");
    return `Ended ${String(name).replace(/_/g, " ")}. (demo: nothing was really ended)`;
  },
  get_events:({ since, n }) => demoEvents(store.machines, since, clock(), n ?? 300),
  get_jobs: ({ since }) => finishedJobs(store.machines, since, clock()),
  open_link: ({ url }) => { if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer"); return null; },
  get_forecast: ({ machine }) => (named(machine) ? forecast(named(machine)) : { per_day: null, days: null }),
  get_machines: () => ({ machines: store.machines.map(m => ({ ...m })) }),
  save_machines: ({ machines }) => {
    const error = checkMachines(machines);
    if (error) return { error };
    store.machines = machines.map(({ was, ...m }) => m);   // `was` only matters to the real collector (it moves history to the new name)
    return {};
  },
  container_action: ({ action, name }) => {
    if (!["restart", "stop", "start", "logs"].includes(action)) throw new Error("Not an action.");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name || "")) throw new Error("That is not a container name docker would accept.");
    if (action !== "logs") return `${{ restart: "Restarted", stop: "Stopped", start: "Started" }[action]} ${name}. (demo)`;
    return Array.from({ length: 50 }, (_, i) => `2026-11-18T09:${String(i).padStart(2, "0")}:00Z ${name} demo log line ${i + 1}`).join("\n") + "\n";
  },
  find_big_folders: ({ machine, path }) => {
    if (!named(machine)) throw new Error("That machine is not in the list.");
    if (!String(path || "").trim() || String(path).startsWith("-")) throw new Error("Type a folder path, like / or D:\\.");
    const id = scans.size + 1; scans.set(id, { path: String(path).trim(), at: Date.now(), stopped: false }); return id;
  },
  get_big_folders: ({ job }) => { const s = scans.get(job); if (!s) throw new Error("That search is no longer there."); return scanState(s, Date.now()); },
  cancel_big_folders: ({ job }) => { const s = scans.get(job); if (s && Date.now() - s.at < SCAN_MS) s.stopped = true; return null; },
  set_internet_host: ({ url }) => { store.internetHost = /^https:\/\/[^\s"]+$/.test(String(url || "").trim()) ? String(url).trim() : ""; return null; },
  get_prefs: () => ({ ...store.prefs }),
  set_prefs: ({ patch }) => Object.assign(store.prefs, patch, { updates: true }) && { ...store.prefs },
  set_window_mode: ({ mode }) => (store.mode = mode),
  set_pinned: ({ on }) => (store.pinned = !!on),
  get_work_size: () => [{ runner: "runner-1", bytes: 3.4e9 }, { runner: "runner-2", bytes: 8.12e8 }], set_mini_size: ok, set_theme: ok, set_tray_status: ok, set_mini_height: ok, restart_collector: ok, relaunch: ok, quit: ok, stop_everything: ok,
  check_for_updates: () => false,
  apply_update: () => false,
  get_version: () => ({ version: "demo", date: 0, packaged: false }),
};
export const COMMANDS = Object.keys(commands);
export const handle = async (command, args = {}) => {
  if (!commands[command]) throw new Error(`unknown command ${command}`);
  return commands[command](args);
};
