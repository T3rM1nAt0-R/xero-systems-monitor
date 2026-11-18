import { normLook, mergeLook, changedPaths, NAME_MAX } from "./model.js";
import { PRESETS, BUILT_IN_COUNT } from "./palettes.js";
import { migrateThemeId } from "./migrate.js";
import { newId, normTheme } from "./files.js";
export { PRESETS, BUILT_IN_COUNT };
// Built-in and saved themes together.
export const allThemes = saved => [...PRESETS, ...saved];
// The look the window shows: the chosen theme with the person's unsaved edits on top. An unknown id means "no theme", just the plain tokens.
export function resolveTheme(saved, id, edits) {
  const t = allThemes(saved).find(x => x.id === migrateThemeId(id));
  return { theme: t || null, look: mergeLook(t?.look, edits) };
}
// "Dark" while nothing is changed, "Custom (based on Dark)" once something is.
export const themeTitle = (theme, dirty) => (dirty ? `Custom (based on ${theme?.name || "Dark"})` : theme?.name || "Dark");
// A user theme from the current look, given a name.
export const makeTheme = (saved, name, base, look) => ({ id: newId(name, allThemes(saved).map(t => t.id)), name: name.trim().slice(0, NAME_MAX) || "My theme", base, look: normLook(look) });
// The saved themes cleaned: each one valid, none sharing an id with a built-in theme.
export const cleanSaved = raw => (Array.isArray(raw) ? raw : []).map(normTheme).filter(t => t.id && !PRESETS.some(p => p.id === t.id));
// What an older version saved ("themes", "themeId", "edits"), brought forward: themes and edits in today's shape, a renamed built-in theme under its new id.
export function migrateStored({ themes, themeId, edits }) {
  const clean = cleanSaved(themes), id = migrateThemeId(typeof themeId === "string" ? themeId : ""), e = normLook(edits);
  return { themes: clean, themeId: id, edits: e, changed: JSON.stringify([clean, id, e]) !== JSON.stringify([themes, themeId, edits]) };
}
// Does the look differ from the chosen theme's own look?
export const isCustom = (theme, look) => changedPaths(theme?.look, look).length > 0;
