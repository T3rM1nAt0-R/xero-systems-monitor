// The only module that talks to the backend. Inside Tauri every function is one named command (docs/window-api.md);
// in a plain browser (`npm run dev`) the same commands are answered by fakeBackend.js with demo data.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { handle } from "./fakeBackend.js";

const inTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
const call = (command, args) => (inTauri() ? invoke(command, args) : handle(command, args));

// Readings
export const getState = () => call("get_state");
export const getHistory = (machine, range) => call("get_history", { machine, range });
export const getEvents = (since, n = 60) => call("get_events", { since, n });
export const getJobs = since => call("get_jobs", { since });
export const getForecast = machine => call("get_forecast", { machine });
// Settings
export const getMachines = () => call("get_machines");
export const saveMachines = machines => call("save_machines", { machines });
export const getPrefs = () => call("get_prefs");
export const setPrefs = patch => call("set_prefs", { patch });
// The window itself
export const windowMode = mode => call("set_window_mode", { mode });   // "mini" | "full" | "compact"
export const setPinned = on => call("set_pinned", { on });
export const setTheme = theme => call("set_theme", { theme });   // "light" | "dark"
export const setMiniHeight = height => call("set_mini_height", { height });
// Updates and life cycle
export const checkForUpdates = () => call("check_for_updates");
export const applyUpdate = () => call("apply_update");
export const version = () => call("get_version");
export const restartCollector = () => call("restart_collector");
export const relaunch = () => call("relaunch");
export const stopEverything = () => call("stop_everything");
export const quit = () => call("quit");

// Things the shell pushes (the tray menu): "window-mode" with a mode name, "pinned" with true/false. Returns a function that stops listening.
export function onShellEvent(name, fn) {
  if (!inTauri()) return () => {};
  let off = null, stopped = false;
  listen(name, e => fn(e.payload)).then(un => (stopped ? un() : (off = un)));
  return () => { stopped = true; if (off) off(); };
}
