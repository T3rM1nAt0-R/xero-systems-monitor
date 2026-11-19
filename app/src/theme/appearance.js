import { baseOf, mergeLook, flatten } from "./model.js";
// One theme, or Follow Windows with a Light slot and a Dark slot. Every tile is one version (light or dark) of a theme: { id, name, side, look }, and its edits are its own.
// The person's edits are kept per tile: editsBy = { [tileId]: edits }. Pure.
export const APPEARANCES = [["one", "One theme"], ["system", "Follow Windows"]];
export const cleanAppearance = a => (a === "system" ? "system" : "one");
export const DEFAULT_SLOTS = { light: "default-light", dark: "dark" };
// Which group a tile belongs to: the background it sets says (a saved theme can set any), otherwise the side it was made for.
export const sideOf = theme => baseOf(theme?.look, theme?.side === "light" ? "light" : "dark");
// Slots with every id a real tile of the right side; anything else is the default for that slot.
export function cleanSlots(raw, themes) {
  const ok = (s, id) => themes.some(t => t.id === id && sideOf(t) === s);
  return Object.fromEntries(Object.keys(DEFAULT_SLOTS).map(s => [s, ok(s, raw?.[s]) ? raw[s] : DEFAULT_SLOTS[s]]));
}
// The slots after `theme` is put in `slot`: only a light tile fits Light and a dark tile fits Dark, anything else changes nothing.
export const fillSlot = (slots, slot, theme) => (theme && slot in DEFAULT_SLOTS && sideOf(theme) === slot ? { ...slots, [slot]: theme.id } : slots);
// The tile showing: the chosen one, or the slot that matches the system setting. A tile that is gone is the plain Dark.
export function activeId({ appearance, themeId, slots }, sysLight, themes) {
  const id = appearance === "system" ? slots[sysLight ? "light" : "dark"] : themeId;
  return themes.some(t => t.id === id) ? id : DEFAULT_SLOTS.dark;
}
// A tile's look with the person's edits on top.
export const lookFor = (theme, edits) => mergeLook(theme?.look, edits);
// What Save keeps: the tile's look with the edits baked in, and which side it is on.
export function bake(theme, edits) {
  const look = lookFor(theme, edits);
  return { look, side: baseOf(look, sideOf(theme)) };
}
export const hasEdits = edits => flatten(edits).length > 0;
