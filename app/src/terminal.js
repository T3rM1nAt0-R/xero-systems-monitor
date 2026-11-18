// The pure side of the Terminal tab: session ids, the list of sub-tabs of one machine, and the xterm look read from the Customize tokens.
// A machine's terminals are { items: [{ id, n }], active: id | null, next: number }; every function returns a new object.
export const MAX_SESSIONS = 8;
export const emptyTerms = () => ({ items: [], active: null, next: 1 });
// The id the shell side accepts: letters, digits, "-" and "_", at most 64. `uid` is a number that is never used twice in this window.
export const sessionId = (machine, uid) => `t${uid}-${String(machine).replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)}`;
export const validSessionId = id => /^[A-Za-z0-9_-]{1,64}$/.test(id);
export const sessionTitle = s => `Shell ${s.n}`;
// Add a session (and make it the active one). Nothing happens at the limit.
export function addTerm(t, machine, uid, admin = false) {
  if (t.items.length >= MAX_SESSIONS) return t;
  const s = { id: sessionId(machine, uid), n: t.next, ...(admin ? { admin: true } : {}) };
  return { items: [...t.items, s], active: s.id, next: t.next + 1 };
}
// Remove a session; if it was the active one, the neighbour to its left (or the first) takes over.
export function closeTerm(t, id) {
  const i = t.items.findIndex(s => s.id === id);
  if (i < 0) return t;
  const items = t.items.filter(s => s.id !== id);
  return { ...t, items, active: t.active === id ? (items[Math.max(0, i - 1)]?.id ?? null) : t.active };
}
export const pickTerm = (t, id) => (t.items.some(s => s.id === id) ? { ...t, active: id } : t);
// The terminal font size: a base size times the window's text scale.
export const BASE_FONT = 13;
export const fontSizeFor = scale => Math.round(BASE_FONT * (Number(scale) > 0 ? Number(scale) : 1));
// The xterm options from the page's custom properties. `get(name)` returns a property's value ("" when missing).
export function xtermLook(get) {
  const c = (name, fallback) => get(name) || fallback;
  return {
    fontFamily: c("--font-mono", "monospace"),
    fontSize: fontSizeFor(get("--scale")),
    theme: {
      background: c("--bg", "#000"), foreground: c("--fg", "#eee"), cursor: c("--acc", "#4cc9f0"), cursorAccent: c("--bg", "#000"),
      selectionBackground: c("--line2", "#444"),
      red: c("--crit", "#f00"), green: c("--ok", "#0f0"), yellow: c("--warn", "#ff0"), blue: c("--c-ram", "#00f"), magenta: c("--c-gpu", "#f0f"), cyan: c("--c-ping", "#0ff"),
      brightRed: c("--bad", "#f55"), brightGreen: c("--c-cpu", "#5f5"), brightYellow: c("--busy", "#ff5"), brightBlue: c("--c-down", "#55f"), brightMagenta: c("--c-up", "#f5f"), brightCyan: c("--c-vram", "#5ff"),
      black: c("--s2", "#222"), white: c("--mid", "#ccc"), brightBlack: c("--dim", "#666"), brightWhite: c("--fg", "#fff"),
    },
  };
}
