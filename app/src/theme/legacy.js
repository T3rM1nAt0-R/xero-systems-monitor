import { normLook, baseOf, flatten, setPath, valueOf, getPath, noColors, colorsOf, cleanColors, SIDES, SCALE_MAX } from "./model.js";
import { pruneAll } from "./edits.js";
import { migrateThemeId } from "./migrate.js";
import { tilesOf } from "./files.js";
import { PRESETS, PAIR_LIGHT } from "./palettes.js";
import { DEFAULT_SLOTS } from "./appearance.js";
// What older versions saved, brought into the tiles model once. Version 0.4.1 kept every theme as a dark and a light version with a Dark / Light / Windows mode and colour edits per side;
// before that there were the separate "theme" (dark, light, Match Windows) and "size" settings and one look that was light or dark by its background. Pure.
const MODES = ["dark", "light", "system"], HUNDRED = 100;
export const LARGE_SCALE = 1.16;
// The built-in themes that were the light version of another one, and the side an older look (one theme, light or dark by its background) was showing.
const OLD_LIGHT = ["light", "solarized-light", "catppuccin-latte"];
const legacySide = (rawTheme, id, edits) => baseOf(normLook(edits), OLD_LIGHT.includes(id) ? "light" : rawTheme ? baseOf(normLook(rawTheme.look), rawTheme.base === "light" ? "light" : "dark") : "dark");
// Edits as 0.4.1 kept them: shared settings, and colours under `colors.dark` and `colors.light`. Old flat colours belong to `legacy`, the side that was shown then.
export function normEdits(raw, legacy = "dark") {
  const shared = noColors(normLook(raw)), c = raw?.colors, split = !!c && (typeof c.dark === "object" || typeof c.light === "object");
  const both = split ? cleanColors(c) : { dark: {}, light: {}, [legacy]: colorsOf(c) };
  const colors = Object.fromEntries(SIDES.filter(s => Object.keys(both[s]).length).map(s => [s, both[s]]));
  return Object.keys(colors).length ? { ...shared, colors } : shared;
}
// The tiles an older theme id means: { dark, light } (a side that has no tile is missing). Built-in pairs come from the palettes; a saved theme from the tiles it was split into.
const versionsOf = (id, saved) => saved[id] || (PRESETS.some(p => p.id === id) ? { dark: id, light: PAIR_LIGHT[id] } : { ...DEFAULT_SLOTS });
// 0.4.1 state { themes, themeId, edits (per side), mode } to the tiles model: saved themes split into tiles, the mode becomes One theme or Follow Windows, edits move onto the matching tiles.
function toTiles({ themes, themeId, edits, mode }) {
  const tiles = [], saved = {};
  for (const r of Array.isArray(themes) ? themes : []) {
    if (!r || typeof r.id !== "string" || !r.id || PRESETS.some(p => p.id === r.id)) continue;
    const ts = tilesOf(r); tiles.push(...ts); saved[r.id] = Object.fromEntries(ts.map(t => [t.side, t.id]));
  }
  const v = versionsOf(themeId, saved), pick = s => v[s] || v.dark || v.light, editsBy = {};
  for (const s of SIDES) {
    const tid = v[s], t = [...PRESETS, ...tiles].find(x => x.id === tid); if (!tid) continue;
    const kept = pruneAll(t, normLook({ ...noColors(edits), ...(edits?.colors?.[s] ? { colors: edits.colors[s] } : {}) }));
    if (flatten(kept).length) editsBy[tid] = kept;
  }
  if (mode === "system") return { themes: tiles, appearance: "system", themeId: pick("dark"), slots: { light: v.light || DEFAULT_SLOTS.light, dark: v.dark || DEFAULT_SLOTS.dark }, editsBy };
  return { themes: tiles, appearance: "one", themeId: pick(mode), slots: { ...DEFAULT_SLOTS }, editsBy };
}
// Whatever an older version saved (`themes`, `themeId`, `edits`, and maybe `theme`, `size`, `mode`), as { themes, appearance, themeId, slots, editsBy }. Done once, so nobody loses their look.
// The earlier Large text switch becomes the text scale, Match Windows also stays the accent colour. `sysLight` is whether the system was set to light.
export function migratePrefs({ themes, themeId, edits, theme, size, mode, sysLight = false }) {
  const raw = Array.isArray(themes) ? themes.find(t => t?.id === themeId) : null, os = getPath(edits, ["surface", "os"]) === true || theme === "system";
  const was = theme === "light" && !themeId ? "light" : legacySide(raw, themeId, edits), side = os ? (sysLight ? "light" : "dark") : was;
  let e = normEdits(edits, side);
  if (size === "large") e = setPath(e, ["scale"], Math.min(SCALE_MAX, Math.round(valueOf(e, "scale") * LARGE_SCALE * HUNDRED) / HUNDRED));
  if (theme === "system") e = setPath(e, ["surface", "os"], true);
  const m = MODES.includes(mode) ? mode : os ? "system" : was;
  return toTiles({ themes, themeId: migrateThemeId(typeof themeId === "string" ? themeId : ""), edits: e, mode: m });
}
