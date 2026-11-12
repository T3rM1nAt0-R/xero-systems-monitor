// The stand-in for the Tauri shell when the window runs in a plain browser. `handle(command, args)` answers every command in docs/window-api.md with demo data of the documented shape.
import { demoMachine, demoEvents, finishedJobs, forecast, history } from "./fakeData.js";

const FIRST = [{ name: "This PC", kind: "local" }, { name: "example-server", kind: "ssh", host: "192.0.2.10", runner: true }];
const store = { machines: FIRST.map(m => ({ ...m })), prefs: { closeToTray: true, login: false, packaged: false }, mode: "full", pinned: true };
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

const commands = {
  get_state: () => ({ machines: store.machines.map(m => demoMachine(m, clock())) }),
  get_history: ({ machine, range }) => (named(machine) ? history(named(machine), range, clock()) : {}),
  get_events: ({ since, n }) => demoEvents(store.machines, since, clock(), n ?? 300),
  get_jobs: ({ since }) => finishedJobs(store.machines, since, clock()),
  get_forecast: ({ machine }) => (named(machine) ? forecast(named(machine)) : { per_day: null, days: null }),
  get_machines: () => ({ machines: store.machines.map(m => ({ ...m })) }),
  save_machines: ({ machines }) => {
    const error = checkMachines(machines);
    if (error) return { error };
    store.machines = machines.map(({ was, ...m }) => m);   // `was` only matters to the real collector (it moves history to the new name)
    return {};
  },
  get_prefs: () => ({ ...store.prefs }),
  set_prefs: ({ patch }) => Object.assign(store.prefs, patch, { packaged: false }) && { ...store.prefs },
  set_window_mode: ({ mode }) => (store.mode = mode),
  set_pinned: ({ on }) => (store.pinned = !!on),
  set_theme: ok, set_mini_height: ok, restart_collector: ok, relaunch: ok, quit: ok, stop_everything: ok,
  check_for_updates: () => false,
  apply_update: () => false,
  get_version: () => ({ version: "demo", date: 0, packaged: false }),
};
export const COMMANDS = Object.keys(commands);
export const handle = async (command, args = {}) => {
  if (!commands[command]) throw new Error(`unknown command ${command}`);
  return commands[command](args);
};
