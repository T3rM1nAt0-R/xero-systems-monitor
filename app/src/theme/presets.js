import { normLook, mergeLook, changedPaths, setPath, valueOf, NAME_MAX, SCALE_MAX } from "./model.js";
import { pruneEdits } from "./edits.js";
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
// The earlier Large text switch, as the text scale it was.
export const LARGE_SCALE = 1.16;
const HUNDRED = 100;
// What the earlier separate "theme" (dark, light or follow Windows) and "size" (normal or large) settings meant, folded into the one look: Light becomes the Light theme,
// follow Windows becomes the Match Windows switch, Large text becomes the text scale (times whatever scale was already set). Done once, so nobody loses their look.
export function migratePrefs({ themes, themeId, edits, theme, size }) {
  const m = migrateStored({ themes, themeId, edits });
  let id = m.themeId, e = m.edits;
  if (theme === "light" && !id) id = "light";
  if (theme === "system") e = setPath(e, ["surface", "os"], true);
  if (size === "large") {
    const t = allThemes(m.themes).find(x => x.id === id), was = valueOf(mergeLook(t?.look, e), "scale");
    e = setPath(e, ["scale"], Math.min(SCALE_MAX, Math.round(was * LARGE_SCALE * HUNDRED) / HUNDRED));
  }
  e = pruneEdits(allThemes(m.themes).find(x => x.id === id)?.look, e);
  return { themes: m.themes, themeId: id, edits: e, changed: m.changed || id !== m.themeId || JSON.stringify(e) !== JSON.stringify(m.edits) };
}
// Does the look differ from the chosen theme's own look?
export const isCustom = (theme, look) => changedPaths(theme?.look, look).length > 0;
