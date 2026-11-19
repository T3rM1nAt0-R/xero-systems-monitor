import { normLook, baseOf, flatten, noColors, cleanColors, SIDES, FILE_MAX, NAME_MAX } from "./model.js";
// Theme files: a saved or imported theme cleaned, written out as JSON text, and read back with a friendly error when it is not one.
const FORMAT = 4, OLDEST = 1;   // older files still read: 1 (the first Customize), 2 (one set of colours), 3 (a dark and a light set in one theme: it becomes two tiles); see migrate.js
const nameOf = raw => String(raw?.name ?? "").trim().slice(0, NAME_MAX) || "Untitled";
// A saved or imported theme, cleaned: one tile { id, name, side, look }. The side is the one it was made for; a background colour in the look decides it when there is one.
export function normTheme(raw) {
  const look = normLook(raw?.look), side = baseOf(look, raw?.side === "light" || (!raw?.side && raw?.base === "light") ? "light" : "dark");
  return { id: typeof raw?.id === "string" ? raw.id : "", name: nameOf(raw), side, look };
}
// Older themes kept a dark and a light set of colours in one theme (`colors: { dark, light }`). Each set with colours becomes its own tile (the dark one keeps the id);
// a theme whose sets are both empty, the same as the plain defaults, becomes one dark tile.
export function tilesOf(raw) {
  const c = raw?.colors;
  if (!c || (typeof c.dark !== "object" && typeof c.light !== "object")) return [normTheme(raw)];
  const both = cleanColors(c), sets = SIDES.filter(s => Object.keys(both[s]).length), keep = sets.length ? sets : ["dark"], shared = noColors(normLook(raw.look));
  return keep.map((s, i) => normTheme({ id: i && raw.id ? `${raw.id}-${s}` : raw.id, name: keep.length > 1 ? `${nameOf(raw)} ${s}` : raw.name, side: s, look: { ...shared, colors: both[s] } }));
}
export const exportTheme = t => { const n = normTheme(t); return JSON.stringify({ "xsm-theme": FORMAT, name: n.name, side: n.side, look: n.look }, null, 2); };
// Pasted theme text to { ok: true, theme, themes } (one tile, or two from an older file that held both versions) or { ok: false, error } (a friendly sentence).
export function parseTheme(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste a theme first." };
  if (text.length > FILE_MAX) return { ok: false, error: "That is too long to be a theme." };
  let raw; try { raw = JSON.parse(text); } catch { return { ok: false, error: "That is not a theme file (it is not valid JSON)." }; }
  const v = raw?.["xsm-theme"];
  if (!(v >= OLDEST && v <= FORMAT)) return { ok: false, error: "That is not a theme exported from this app." };
  const themes = tilesOf(raw);
  if (themes.every(t => !flatten(t.look).length)) return { ok: false, error: "That theme has nothing in it to apply." };
  return { ok: true, theme: themes[0], themes };
}
// A new id from a name that no theme in `taken` uses yet.
export function newId(name, taken) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
  let id = "my-" + slug, n = 2; while (taken.includes(id)) id = `my-${slug}-${n++}`;
  return id;
}
