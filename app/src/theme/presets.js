import { normLook, normTheme, mergeLook, newId } from "./model.js";
// The built-in themes. Dark and Light are the plain tokens (tokens.css); the others change colours on top of a dark base.
const P = (id, name, base, colors = {}) => ({ id, name, base, look: normLook({ colors }), builtIn: true });
export const PRESETS = [
  P("dark", "Dark", "dark"),
  P("light", "Light", "light"),
  P("midnight", "Midnight", "dark", { bg: "#05070f", card: "#0b1020", line: "#18213a", fg: "#dbe4ff", dim: "#8392bd", acc: "#7aa2ff", ping: "#7aa2ff" }),
  P("solarized", "Solarized-like", "dark", { bg: "#002b36", card: "#073642", line: "#0f4a58", fg: "#eee8d5", dim: "#93a1a1", acc: "#2aa198", good: "#859900", warn: "#b58900", bad: "#dc322f", cpu: "#859900", ram: "#268bd2", gpu: "#6c71c4", temp: "#cb4b16", disk: "#b58900" }),
  P("contrast", "High contrast", "dark", { bg: "#000000", card: "#000000", line: "#8a8a8a", fg: "#ffffff", dim: "#d4d4d4", acc: "#ffe600", good: "#4dff88", warn: "#ffb000", bad: "#ff6b6b" }),
  P("neon", "Neon", "dark", { bg: "#0a0010", card: "#12001f", line: "#3a0a5c", fg: "#f5eaff", dim: "#b08cd9", acc: "#ff2bd6", good: "#39ff14", warn: "#ffee00", bad: "#ff3860", cpu: "#39ff14", ram: "#00e5ff", gpu: "#ff2bd6", temp: "#ff9100", disk: "#ffee00" }),
];
// Built-in and saved themes together.
export const allThemes = saved => [...PRESETS, ...saved];
// The look the window shows: the chosen theme with the person's unsaved edits on top. An unknown id means "no theme", just the plain tokens.
export function resolveTheme(saved, id, edits) {
  const t = allThemes(saved).find(x => x.id === id);
  return { theme: t || null, look: mergeLook(t?.look, edits) };
}
// A user theme from the current look, given a name.
export const makeTheme = (saved, name, base, look) => ({ id: newId(name, allThemes(saved).map(t => t.id)), name: name.trim() || "My theme", base, look: normLook(look) });
// The saved themes cleaned: each one valid, none sharing an id with a built-in theme.
export const cleanSaved = raw => (Array.isArray(raw) ? raw : []).map(normTheme).filter(t => t.id && !PRESETS.some(p => p.id === t.id));
