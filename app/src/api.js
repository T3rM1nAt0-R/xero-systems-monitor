// The only module that talks to the backend. Inside Tauri every function is one named command (docs/window-api.md);
// in a plain browser (`npm run dev`) the same commands are answered by fakeBackend.js with demo data.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { handle, onFakeEvent } from "./fakeBackend.js";
import { isGithubUrl } from "./github.js";

const inTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
const call = (command, args) => (inTauri() ? invoke(command, args) : handle(command, args));

// Readings
export const getState = () => call("get_state");
export const getHistory = (machine, range) => call("get_history", { machine, range });
export const getBusyAt = (machine, t) => call("get_busy_at", { machine, t });
export const getBusiest = (machine, range) => call("get_busiest", { machine, range });   // what was busy over the last `range` seconds: { minutes, top: [name, cpu %, MB, minutes][] }
export const endTask = (machine, pid, name) => call("end_task", { machine, pid, name });   // resolves to a sentence, rejects with a plain message
export const getEvents = (since, n = 60) => call("get_events", { since, n });
export const getJobs = since => call("get_jobs", { since });
export const getForecast = machine => call("get_forecast", { machine });
// Open a job on GitHub in the browser. Only https://github.com/ addresses go through.
export const openLink = url => (isGithubUrl(url) ? call("open_link", { url }) : Promise.resolve(null));
export const containerAction = (machine, action, name) => call("container_action", { machine, action, name });   // action: "restart" | "stop" | "start" | "logs"; resolves to text, rejects with a plain message
// The biggest-folders search of the Disks tab: start it, ask how far it is, stop it. It only reads.
export const findBigFolders = (machine, path) => call("find_big_folders", { machine, path });   // resolves to a job number
export const getBigFolders = job => call("get_big_folders", { job });   // { state: "running", seen } | { state: "done", folders: [{ path, bytes }] } | { state: "cancelled" } | { state: "failed", error }
export const cancelBigFolders = job => call("cancel_big_folders", { job });
export const setInternetHost = url => call("set_internet_host", { url });   // the address the internet check uses; only a plain https:// address, anything else means the default
// Settings
export const getMachines = () => call("get_machines");
export const saveMachines = machines => call("save_machines", { machines });
export const getPrefs = () => call("get_prefs");
export const setPrefs = patch => call("set_prefs", { patch });
// The window itself
export const windowMode = mode => call("set_window_mode", { mode });   // "mini" | "full" | "compact"
export const setPinned = on => call("set_pinned", { on });
export const setTheme = theme => call("set_theme", { theme });   // "light" | "dark"
export const setTrayStatus = (status, tooltip) => call("set_tray_status", { status, tooltip });   // "calm" | "look" | "bad"
export const setMiniHeight = height => call("set_mini_height", { height });
export const setMiniSize = (width, height) => call("set_mini_size", { width, height });   // mini only: the size you dragged it to, put back when mini opens
export const getWorkSize = machine => call("get_work_size", { machine });   // [{ runner, bytes | null }], slow: on demand only
// Updates and life cycle
export const checkForUpdates = () => call("check_for_updates");
export const applyUpdate = () => call("apply_update");
export const version = () => call("get_version");
export const restartCollector = () => call("restart_collector");
export const relaunch = () => call("relaunch");
export const stopEverything = () => call("stop_everything");
export const quit = () => call("quit");

// Terminal tab (docs/window-api.md): output and exit arrive as events, see onShellEvent("terminal-output" | "terminal-exit", fn).
export const terminalOpen = (id, machine, cols, rows) => call("terminal_open", { id, machine, cols, rows });
export const terminalWrite = (id, data) => call("terminal_write", { id, data });
export const terminalResize = (id, cols, rows) => call("terminal_resize", { id, cols, rows });
export const terminalClose = id => call("terminal_close", { id });

// Things the shell pushes (the tray menu): "window-mode" with a mode name, "pinned" with true/false. Returns a function that stops listening.
export function onShellEvent(name, fn) {
  if (!inTauri()) return onFakeEvent(name, fn);
  let off = null, stopped = false;
  listen(name, e => fn(e.payload)).then(un => (stopped ? un() : (off = un)));
  return () => { stopped = true; if (off) off(); };
}
