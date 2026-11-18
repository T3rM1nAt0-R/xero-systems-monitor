import { normLook, baseOf, flatten, FILE_MAX, NAME_MAX } from "./model.js";
import { cleanColors, noColors, SIDES } from "./modes.js";
// Theme files: a saved or imported theme cleaned, written out as JSON text, and read back with a friendly error when it is not one.
const FORMAT = 3, OLDEST = 1;   // older files still read: version 1 (the first Customize) and 2 (one set of colours); see migrate.js
// A saved or imported theme, cleaned: { id, name, look (shared settings), colors: { dark, light } }. An older theme (one look, colours inside it, a `base`) puts its colours on its own side.
export function normTheme(raw) {
  const look = normLook(raw?.look), colors = raw?.colors ? cleanColors(raw.colors) : { dark: {}, light: {} };
  if (look.colors && !raw?.colors) colors[baseOf(look, raw?.base === "light" ? "light" : "dark")] = look.colors;
  return { id: typeof raw?.id === "string" ? raw.id : "", name: String(raw?.name ?? "").trim().slice(0, NAME_MAX) || "Untitled", look: noColors(look), colors };
}
export const exportTheme = t => { const n = normTheme(t); return JSON.stringify({ "xsm-theme": FORMAT, name: n.name, look: n.look, colors: n.colors }, null, 2); };
// Pasted theme text to { ok: true, theme } or { ok: false, error } (a friendly sentence).
export function parseTheme(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste a theme first." };
  if (text.length > FILE_MAX) return { ok: false, error: "That is too long to be a theme." };
  let raw; try { raw = JSON.parse(text); } catch { return { ok: false, error: "That is not a theme file (it is not valid JSON)." }; }
  const v = raw?.["xsm-theme"];
  if (!(v >= OLDEST && v <= FORMAT)) return { ok: false, error: "That is not a theme exported from this app." };
  const t = normTheme(raw);
  if (!flatten(t.look).length && !SIDES.some(x => Object.keys(t.colors[x]).length)) return { ok: false, error: "That theme has nothing in it to apply." };
  return { ok: true, theme: t };
}
// A new id from a name that no theme in `taken` uses yet.
export function newId(name, taken) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
  let id = "my-" + slug, n = 2; while (taken.includes(id)) id = `my-${slug}-${n++}`;
  return id;
}
