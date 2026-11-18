import { setPath, valueOf, getPath, SCALE_MAX } from "./model.js";
import { pruneAll } from "./edits.js";
import { lookFor, bake, normEdits, hasEdits, cleanMode, legacySide } from "./modes.js";
import { PRESETS, BUILT_IN_COUNT } from "./palettes.js";
import { migrateThemeId } from "./migrate.js";
import { newId, normTheme } from "./files.js";
export { PRESETS, BUILT_IN_COUNT };
// Built-in and saved themes together.
export const allThemes = saved => [...PRESETS, ...saved];
// The look the window shows on one side (dark or light): the chosen theme with the person's unsaved edits on top. An unknown id means "no theme", just the plain tokens.
export function resolveTheme(saved, id, edits, side = "dark") {
  const t = allThemes(saved).find(x => x.id === migrateThemeId(id));
  return { theme: t || null, look: lookFor(t, edits, side) };
}
// "Dark" while nothing is changed, "Custom (based on Dark)" once something is.
export const themeTitle = (theme, dirty) => (dirty ? `Custom (based on ${theme?.name || "Dark"})` : theme?.name || "Dark");
// A user theme from the current look (both versions, edits baked in: see bake), given a name.
export const makeTheme = (saved, name, baked) => normTheme({ ...baked, id: newId(name, allThemes(saved).map(t => t.id)), name: name.trim() || "My theme" });
// The saved themes cleaned: each one valid, none sharing an id with a built-in theme.
export const cleanSaved = raw => (Array.isArray(raw) ? raw : []).map(normTheme).filter(t => t.id && !PRESETS.some(p => p.id === t.id));
// What an older version saved ("themes", "themeId", "edits"), brought forward: themes and edits in today's shape (colours per side; `legacy` is the side old flat colours belong to),
// a renamed built-in theme under its new id.
export function migrateStored({ themes, themeId, edits }, legacy = "dark") {
  const clean = cleanSaved(themes), id = migrateThemeId(typeof themeId === "string" ? themeId : ""), e = normEdits(edits, legacy);
  return { themes: clean, themeId: id, edits: e, changed: JSON.stringify([clean, id, e]) !== JSON.stringify([themes, themeId, edits]) };
}
// The earlier Large text switch, as the text scale it was.
export const LARGE_SCALE = 1.16;
const HUNDRED = 100;
// What the earlier separate "theme" (dark, light or follow Windows) and "size" (normal or large) settings meant, and the one look before light and dark became two versions of each theme,
// folded into today's: the mode (Dark, Light or Windows) comes from the old light theme / the old light-or-dark of the look / Match Windows; old colour edits move to that side;
// Large text becomes the text scale. Done once (when no mode is saved yet), so nobody loses their look. `sysLight` is whether the system was set to light.
export function migratePrefs({ themes, themeId, edits, theme, size, mode, sysLight = false }) {
  const raw = Array.isArray(themes) ? themes.find(t => t?.id === themeId) : null, os = getPath(edits, ["surface", "os"]) === true || theme === "system";
  const was = theme === "light" && !themeId ? "light" : legacySide(raw, themeId, edits), side = os ? (sysLight ? "light" : "dark") : was;
  const m = migrateStored({ themes, themeId, edits }, side), id = m.themeId, t = allThemes(m.themes).find(x => x.id === id);
  let e = m.edits;
  if (size === "large") e = setPath(e, ["scale"], Math.min(SCALE_MAX, Math.round(valueOf(lookFor(t, e, side), "scale") * LARGE_SCALE * HUNDRED) / HUNDRED));
  if (theme === "system") e = setPath(e, ["surface", "os"], true);   // Match Windows was also the accent colour
  e = pruneAll(t, e);
  const next = mode === undefined ? (os ? "system" : was) : cleanMode(mode);
  return { themes: m.themes, themeId: id, edits: e, mode: next, changed: m.changed || next !== mode || JSON.stringify(e) !== JSON.stringify(m.edits) };
}
// Has the person changed anything on top of the chosen theme?
export const isCustom = hasEdits;
export { bake };
