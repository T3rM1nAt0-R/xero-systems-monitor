import { baseOf, mergeLook, flatten, noColors, unflatten } from "./model.js";
// One theme, or Follow Windows with a Light slot and a Dark slot. Every tile is one version (light or dark) of a theme: { id, name, side, look }, and its edits are its own.
// The person's edits come in two kinds: colours are kept per tile (editsBy = { [tileId]: { colors } }), everything else (text, shape, glass, graphs, layout, motion, the accent switch)
// is one shared set that sits on top of whichever tile is showing, so Windows swapping the tile at sunset changes colours only. Pure.
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
// A tile's look with the shared edits on top (they override only what the person set), then the tile's own colour edits.
export const lookFor = (theme, colorEdits, shared) => mergeLook(mergeLook(theme?.look, noColors(shared)), colorEdits);
// What Save keeps: the tile's look with every edit baked in, and which side it is on.
export function bake(theme, colorEdits, shared) {
  const look = lookFor(theme, colorEdits, shared);
  return { look, side: baseOf(look, sideOf(theme)) };
}
// Edits split in two: the colours, and everything else.
export const colorsPart = e => (e?.colors ? { colors: e.colors } : {});
// Per-tile edit sets (an older shape: everything per tile) folded into one shared set; the tile showing wins where tiles disagree.
export function foldShared(editsBy, showingId) {
  const ids = Object.keys(editsBy || {}).filter(k => k !== showingId).concat(showingId in (editsBy || {}) ? [showingId] : []);
  return unflatten(ids.flatMap(k => flatten(noColors(editsBy[k]))));
}
export const hasEdits = edits => flatten(edits).length > 0;
