// The xterm side of the Terminal tab. Loaded only when the tab first opens (Terminal.jsx imports it on demand), so the
// terminal library costs nothing at startup. Each session keeps its xterm and its element here, so switching tabs
// or machines never loses a shell; the element is just moved in and out of the page.
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { terminalOpen, terminalWrite, terminalResize, terminalClose, onShellEvent } from "./api.js";
import { subscribe as onLook } from "./colors.js";
import { xtermLook } from "./terminal.js";

const live = new Map();   // id -> { term, fit, el, got, ended, note }
const look = () => { const cs = getComputedStyle(document.documentElement); return xtermLook(n => cs.getPropertyValue(n).trim()); };
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  onShellEvent("terminal-output", ({ id, data }) => {
    const s = live.get(id); if (!s) return;
    s.term.write(data);
    if (!s.got) { s.got = true; s.note(); }
  });
  onShellEvent("terminal-exit", ({ id }) => {
    const s = live.get(id); if (!s) return;
    s.ended = true; s.got = true; s.term.write("\r\n\x1b[2m[The session ended. Close this tab or open a new one.]\x1b[0m\r\n"); s.note();
  });
  onLook(() => { const o = look(); for (const { term } of live.values()) { term.options.fontFamily = o.fontFamily; term.options.fontSize = o.fontSize; term.options.theme = o.theme; } });
  window.addEventListener("pagehide", () => { for (const id of live.keys()) terminalClose(id); });
}
// Ctrl+Shift+C copies the selection and Ctrl+Shift+V pastes; plain Ctrl+C still reaches the shell.
function clipboardKeys(term) {
  term.attachCustomKeyEventHandler(e => {
    if (e.type !== "keydown" || !e.ctrlKey || !e.shiftKey) return true;
    if (e.code === "KeyC") { const t = term.getSelection(); if (t) navigator.clipboard?.writeText(t).catch(() => {}); return false; }
    if (e.code === "KeyV") { navigator.clipboard?.readText().then(t => t && term.paste(t)).catch(() => {}); return false; }
    return true;
  });
}
// Start a session for `machine`. `note` is called when its state changes (first output, ended).
export function open(id, machine, note) {
  wire();
  if (live.has(id)) { live.get(id).note = note; return; }
  const term = new Terminal({ ...look(), cursorBlink: true, scrollback: 5000 }), fit = new FitAddon(), el = document.createElement("div");
  el.className = "termhost";
  term.loadAddon(fit);
  term.open(el);
  clipboardKeys(term);
  const s = { term, fit, el, got: false, ended: false, note };
  live.set(id, s);
  term.onData(d => { if (!s.ended) terminalWrite(id, d).catch(() => {}); });
  term.onResize(({ cols, rows }) => { if (!s.ended) terminalResize(id, cols, rows).catch(() => {}); });
  terminalOpen(id, machine, term.cols, term.rows).catch(e => { s.ended = true; s.got = true; term.write(`\x1b[31m${e?.message || e}\x1b[0m\r\n`); s.note(); });
}
// Put the session's terminal into `container`, fit it to the space and focus it. Returns a function that stops watching the size.
export function show(id, container) {
  const s = live.get(id); if (!s) return () => {};
  container.replaceChildren(s.el);
  const refit = () => { try { s.fit.fit(); } catch { /* not laid out yet */ } };
  const ro = new ResizeObserver(refit);
  ro.observe(container); refit(); s.term.focus();
  return () => ro.disconnect();
}
export const state = id => { const s = live.get(id); return { got: !!s?.got, ended: !!s?.ended }; };
export function close(id) {
  const s = live.get(id); if (!s) return;
  live.delete(id); terminalClose(id).catch(() => {}); s.term.dispose(); s.el.remove();
}
