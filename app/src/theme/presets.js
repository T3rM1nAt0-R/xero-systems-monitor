import { PRESETS, PAIR_LIGHT } from "./palettes.js";
import { lookFor, bake, hasEdits, sideOf, colorsPart } from "./appearance.js";
import { normTheme, newId } from "./files.js";
import { pruneAll, pruneEdits } from "./edits.js";
import { noColors, normLook } from "./model.js";
import { LARGE_SCALE, migratePrefs } from "./legacy.js";
export { PRESETS, PAIR_LIGHT, LARGE_SCALE, migratePrefs, bake };
// Built-in and saved themes together.
export const allThemes = saved => [...PRESETS, ...saved];
// The look of the tile `id` with the person's edits for it on top (`editsBy` keeps each tile's own). An unknown id means "no theme", just the plain tokens.
export function resolveTheme(saved, id, editsBy, shared) {
  const t = allThemes(saved).find(x => x.id === id);
  return { theme: t || null, look: lookFor(t, editsBy?.[id], shared) };
}
// "Default Dark" while nothing is changed, "Custom (based on Default Dark)" once something is.
export const themeTitle = (theme, dirty) => (dirty ? `Custom (based on ${theme?.name || "Default Dark"})` : theme?.name || "Default Dark");
// A user theme from a tile and its edits (see bake), given a name. It is one version, light or dark by its background.
export const makeTheme = (saved, name, baked) => normTheme({ ...baked, id: newId(name, allThemes(saved).map(t => t.id)), name: name.trim() || "My theme" });
// The saved themes cleaned: each one valid, none sharing an id with a built-in theme.
export const cleanSaved = raw => (Array.isArray(raw) ? raw : []).map(normTheme).filter(t => t.id && !PRESETS.some(p => p.id === t.id));
// The shared (non-colour) edits cleaned. They are dropped when they change nothing on the tile showing (pruneShared), so "no change" stays empty.
export const cleanShared = raw => noColors(normLook(raw));
export const pruneShared = (theme, shared) => pruneEdits(theme?.look, shared);
// Each tile's colour edits cleaned and pruned against that tile; tiles that are gone or have nothing left drop out.
export function cleanEditsBy(raw, themes) {
  const out = {};
  for (const [id, e] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    const t = themes.find(x => x.id === id), kept = t ? pruneAll(t, colorsPart(e)) : {};
    if (hasEdits(kept)) out[id] = kept;
  }
  return out;
}
// The dark and the light tiles, each group in gallery order.
export const bySide = themes => ({ dark: themes.filter(t => sideOf(t) === "dark"), light: themes.filter(t => sideOf(t) === "light") });
// Has the person changed anything on top of the chosen tile?
export const isCustom = hasEdits;
