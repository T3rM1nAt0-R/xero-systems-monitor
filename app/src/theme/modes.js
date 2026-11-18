import { normLook, mergeLook, flatten, baseOf } from "./model.js";
// Light and dark versions of one theme. A theme keeps its shared look (shape, text, graphs, ...: `look`, no colours) and its colours once for each side: `colors: { dark, light }`.
// The person's unsaved edits are shaped the same way: shared settings as before, colour edits under `colors.dark` and `colors.light`. Pure.
export const MODES = [["dark", "Dark"], ["light", "Light"], ["system", "Windows"]];
export const SIDES = ["dark", "light"];
export const cleanMode = m => (MODES.some(([k]) => k === m) ? m : "dark");
// The side (dark or light) a mode shows; Windows follows the system.
export const sideOf = (mode, sysLight) => (mode === "system" ? (sysLight ? "light" : "dark") : mode === "light" ? "light" : "dark");
export const colorsOf = raw => normLook({ colors: raw }).colors || {};
export const noColors = look => Object.fromEntries(Object.entries(look || {}).filter(([k]) => k !== "colors"));
export const cleanColors = raw => ({ dark: colorsOf(raw?.dark), light: colorsOf(raw?.light) });
// Edits in today's shape from whatever was stored. Old flat colours (colors.bg) belong to `legacy`, the side that was shown then.
export function normEdits(raw, legacy = "dark") {
  const shared = noColors(normLook(raw)), c = raw?.colors, split = !!c && (typeof c.dark === "object" || typeof c.light === "object");
  const both = split ? cleanColors(c) : { dark: {}, light: {}, [legacy]: colorsOf(c) };
  const colors = Object.fromEntries(SIDES.filter(s => Object.keys(both[s]).length).map(s => [s, both[s]]));
  return Object.keys(colors).length ? { ...shared, colors } : shared;
}
// The look a theme shows on one side, with the edits on top.
export const lookFor = (theme, edits, side) => mergeLook(mergeLook(theme?.look, { colors: theme?.colors?.[side] }), { ...noColors(edits), colors: colorsOf(edits?.colors?.[side]) });
// A theme's look and colours with the edits baked in (what Save keeps): both sides.
export const bake = (theme, edits) => ({ look: mergeLook(theme?.look, noColors(edits)), colors: Object.fromEntries(SIDES.map(s => [s, { ...theme?.colors?.[s], ...colorsOf(edits?.colors?.[s]) }])) });
export const hasEdits = edits => flatten(edits).length > 0;
// The built-in themes that were the light version of another one, and the side an older look (one theme, light or dark by its background) was showing.
export const OLD_LIGHT = ["light", "solarized-light", "catppuccin-latte"];
export const legacySide = (rawTheme, id, edits) => baseOf(normLook(edits), OLD_LIGHT.includes(id) ? "light" : rawTheme ? baseOf(normLook(rawTheme.look), rawTheme.base === "light" ? "light" : "dark") : "dark");
