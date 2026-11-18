import { normLook, flatten, FILE_MAX, NAME_MAX } from "./model.js";
// Theme files: a saved or imported theme cleaned, written out as JSON text, and read back with a friendly error when it is not one.
export const BASES = ["dark", "light"];
const FORMAT = 2, OLDEST = 1;   // version 1 files (the first Customize) still read; see migrate.js
// A saved or imported theme, cleaned: { id, name, base, look }.
export const normTheme = raw => ({ id: typeof raw?.id === "string" ? raw.id : "", name: String(raw?.name ?? "").trim().slice(0, NAME_MAX) || "Untitled", base: BASES.includes(raw?.base) ? raw.base : "dark", look: normLook(raw?.look) });
export const exportTheme = t => JSON.stringify({ "xsm-theme": FORMAT, name: t.name, base: t.base, look: normLook(t.look) }, null, 2);
// Pasted theme text to { ok: true, theme } or { ok: false, error } (a friendly sentence).
export function parseTheme(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste a theme first." };
  if (text.length > FILE_MAX) return { ok: false, error: "That is too long to be a theme." };
  let raw; try { raw = JSON.parse(text); } catch { return { ok: false, error: "That is not a theme file (it is not valid JSON)." }; }
  const v = raw?.["xsm-theme"];
  if (!(v >= OLDEST && v <= FORMAT)) return { ok: false, error: "That is not a theme exported from this app." };
  if (!flatten(normLook(raw.look)).length) return { ok: false, error: "That theme has nothing in it to apply." };
  return { ok: true, theme: normTheme(raw) };
}
// A new id from a name that no theme in `taken` uses yet.
export function newId(name, taken) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
  let id = "my-" + slug, n = 2; while (taken.includes(id)) id = `my-${slug}-${n++}`;
  return id;
}
