import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, PAIR_LIGHT, resolveTheme, makeTheme, bake, cleanEditsBy, bySide } from "../src/theme/presets.js";
import { migratePrefs } from "../src/theme/legacy.js";
import { sideOf, cleanSlots, fillSlot, activeId, cleanAppearance, DEFAULT_SLOTS, lookFor } from "../src/theme/appearance.js";
import { pruneAll } from "../src/theme/edits.js";
import { startHistory, record, undo } from "../src/theme/history.js";
import { parseTheme } from "../src/theme/files.js";
import { fullColors, contrastWarning, lookToCss } from "../src/theme/css.js";
import { contrast, MIN_FAINT } from "../src/theme/colors.js";

const by = id => PRESETS.find(p => p.id === id);
const none = { themes: [], themeId: "", edits: {} };

test("real pairs and dark-only themes: every pair has a dark and a light tile, the dark-only ones have no light twin", () => {
  assert.deepEqual(Object.keys(PAIR_LIGHT), ["dark", "solarized", "catppuccin", "gruvbox", "tokyo-night", "nord", "contrast"]);
  for (const [d, l] of Object.entries(PAIR_LIGHT)) { assert.equal(by(d).side, "dark"); assert.equal(by(l).side, "light"); }
  for (const id of ["terminal", "dracula", "neon", "midnight", "blueprint"]) assert.equal(PAIR_LIGHT[id], undefined, id);
  const g = bySide(PRESETS); assert.equal(g.dark.length, 12); assert.equal(g.light.length, 7);
  assert.equal(new Set(PRESETS.map(p => p.id)).size, PRESETS.length);
});

test("every tile keeps readable text, a visible accent and the faint floor", () => {
  for (const p of PRESETS) {
    const look = lookFor(p, {}), c = fullColors(look, p.side), id = p.id;
    assert.equal(sideOf(p), p.side, id + " is filed where its background says");
    assert.equal(contrastWarning(look, p.side), "", id);
    assert.ok(contrast(c.acc, c.bg) >= 3, id + " accent");
    for (const on of [c.bg, c.card]) assert.ok(contrast(c.dim2, on) >= MIN_FAINT - 0.01, id + " faint text");
    assert.equal(lookToCss(look, { base: p.side }).attrs["data-theme"], p.side, id + " data-theme");
  }
});

test("slots: a light tile cannot go in the Dark slot and a dark tile cannot go in Light", () => {
  const slots = { ...DEFAULT_SLOTS };
  assert.deepEqual(fillSlot(slots, "light", by("nord-light")), { light: "nord-light", dark: "dark" });
  assert.deepEqual(fillSlot(slots, "dark", by("nord")), { light: "default-light", dark: "nord" });
  assert.equal(fillSlot(slots, "dark", by("nord-light")), slots); assert.equal(fillSlot(slots, "light", by("dracula")), slots);
  assert.equal(fillSlot(slots, "dark", undefined), slots); assert.equal(fillSlot(slots, "middle", by("nord")), slots);
  const mine = makeTheme([], "Mine", bake(by("dark"), { colors: { bg: "#fafafa" } }));
  assert.equal(mine.side, "light", "a saved theme's side is decided by its background");
  assert.equal(fillSlot(slots, "light", mine).light, mine.id);
  assert.deepEqual(cleanSlots({ light: "dracula", dark: "nord-light" }, PRESETS), DEFAULT_SLOTS, "wrong side or gone: the default");
  assert.deepEqual(cleanSlots({ light: "gruvbox-light", dark: "dracula" }, PRESETS), { light: "gruvbox-light", dark: "dracula" });
  assert.deepEqual(cleanSlots(undefined, PRESETS), DEFAULT_SLOTS);
});

test("the active tile follows the system in Follow Windows and is the chosen one otherwise", () => {
  const slots = { light: "solarized-light", dark: "nord" }, all = PRESETS;
  assert.equal(activeId({ appearance: "system", themeId: "dracula", slots }, true, all), "solarized-light");
  assert.equal(activeId({ appearance: "system", themeId: "dracula", slots }, false, all), "nord");
  assert.equal(activeId({ appearance: "one", themeId: "dracula", slots }, true, all), "dracula");
  assert.equal(activeId({ appearance: "one", themeId: "gone", slots }, true, all), "dark");
  assert.equal(cleanAppearance("system"), "system"); assert.equal(cleanAppearance("dark"), "one");
});

test("edits are kept per tile and pruned against that tile", () => {
  const editsBy = { nord: { colors: { acc: "#112233" } }, "nord-light": { colors: { acc: "#4f6f98" } }, gone: { graph: { style: "bars" } } };
  assert.equal(resolveTheme([], "nord", editsBy).look.colors.acc, "#112233");
  assert.equal(resolveTheme([], "nord-light", editsBy).look.colors.acc, "#4f6f98");
  assert.equal(resolveTheme([], "solarized", editsBy).look.colors.acc, "#268bd2", "another tile does not see them");
  assert.deepEqual(cleanEditsBy(editsBy, PRESETS), { nord: { colors: { acc: "#112233" } } }, "choosing the tile's own value is no edit; a gone tile drops out");
  assert.deepEqual(pruneAll(by("nord"), { colors: { acc: "#88c0d0" }, shape: { family: "rounded" } }), {});
  assert.deepEqual(cleanEditsBy(null, PRESETS), {});
  let h = startHistory({ themeId: "nord", slots: DEFAULT_SLOTS, editsBy: {} });
  h = record(h, { ...h.present, editsBy: { nord: { colors: { bg: "#101010" } } } }, "a");
  h = record(h, { ...h.present, editsBy: { ...h.present.editsBy, "nord-light": { colors: { bg: "#fafafa" } } } }, "b");
  h = undo(h); assert.equal(h.present.editsBy["nord-light"], undefined); assert.equal(h.present.editsBy.nord.colors.bg, "#101010");
});

test("migration: mode dark or light plus a theme becomes One theme with that version, else the dark one", () => {
  const dark = migratePrefs({ ...none, themeId: "nord", mode: "dark" }), light = migratePrefs({ ...none, themeId: "nord", mode: "light" });
  assert.deepEqual([dark.appearance, dark.themeId], ["one", "nord"]); assert.deepEqual([light.appearance, light.themeId], ["one", "nord-light"]);
  assert.equal(migratePrefs({ ...none, themeId: "dracula", mode: "light" }).themeId, "dracula", "dark only: the dark one");
  assert.equal(migratePrefs({ ...none, themeId: "catppuccin", mode: "light" }).themeId, "catppuccin-latte");
  assert.equal(migratePrefs({ ...none, themeId: "tokyo-night", mode: "light" }).themeId, "tokyo-day");
  assert.equal(migratePrefs({ ...none, themeId: "", mode: "light" }).themeId, "default-light");
  assert.equal(migratePrefs({ ...none, themeId: "solarized-light" }).themeId, "solarized-light", "an old light twin id means the light version of the pair");
  assert.deepEqual(migratePrefs({ ...none, themeId: "catppuccin-mocha" }).themeId, "catppuccin");
});

test("migration: mode Windows becomes Follow Windows with the theme's light and dark in the slots", () => {
  const m = migratePrefs({ ...none, themeId: "gruvbox", mode: "system" });
  assert.equal(m.appearance, "system"); assert.deepEqual(m.slots, { light: "gruvbox-light", dark: "gruvbox" });
  const d = migratePrefs({ ...none, themeId: "neon", mode: "system" });
  assert.deepEqual(d.slots, { light: "default-light", dark: "neon" }, "no light version: Default Light");
  assert.equal(migratePrefs({ ...none, theme: "system" }).appearance, "system");
});

test("migration: colour edits made per mode move onto the matching tiles; shared ones go on both", () => {
  const edits = { colors: { dark: { acc: "#112233" }, light: { acc: "#445566" } }, graph: { style: "bars" } };
  const m = migratePrefs({ ...none, themeId: "nord", edits, mode: "system" });
  assert.deepEqual(m.editsBy.nord, { colors: { acc: "#112233" }, graph: { style: "bars" } });
  assert.deepEqual(m.editsBy["nord-light"], { colors: { acc: "#445566" }, graph: { style: "bars" } });
  const dark = migratePrefs({ ...none, themeId: "dracula", edits, mode: "dark" });
  assert.deepEqual(Object.keys(dark.editsBy), ["dracula"], "a dark-only theme has no light tile to hold the light edits");
  const again = migratePrefs({ ...none, themeId: "nord", edits: { colors: { acc: "#88c0d0" } }, mode: "dark" });
  assert.deepEqual(again.editsBy, {}, "an edit equal to the tile's own value is dropped");
  const flat = migratePrefs({ ...none, themeId: "solarized-light", edits: { colors: { acc: "#0000aa" } } });
  assert.equal(flat.editsBy["solarized-light"].colors.acc, "#0000aa", "old flat colours went with the version that was showing");
});

test("migration: saved themes (one version, or both) become tiles", () => {
  const both = { id: "my-x", name: "X", look: { graph: { style: "step" } }, colors: { dark: { bg: "#101010", acc: "#102030" }, light: { bg: "#fafafa", acc: "#203040" } } };
  const m = migratePrefs({ themes: [both], themeId: "my-x", edits: {}, mode: "light" });
  assert.deepEqual(m.themes.map(t => [t.id, t.name, t.side]), [["my-x", "X dark", "dark"], ["my-x-light", "X light", "light"]]);
  assert.equal(m.themeId, "my-x-light"); assert.equal(m.themes[1].look.graph.style, "step");
  const sys = migratePrefs({ themes: [both], themeId: "my-x", edits: {}, mode: "system" });
  assert.deepEqual(sys.slots, { light: "my-x-light", dark: "my-x" });
  const plain = migratePrefs({ themes: [{ id: "my-p", name: "P", look: { shape: { family: "soft" } }, colors: { dark: {}, light: {} } }], themeId: "my-p", edits: {}, mode: "dark" });
  assert.deepEqual(plain.themes.map(t => [t.id, t.name]), [["my-p", "P"]], "both sides the same as the defaults: one tile");
  const light = migratePrefs({ themes: [{ id: "my-l", name: "L", base: "light", look: { colors: { bg: "#fafafa" } } }], themeId: "my-l", edits: {}, mode: "light" });
  assert.deepEqual([light.themes[0].side, light.themeId], ["light", "my-l"]);
});

test("theme files of format 3 import as two tiles, or one when a side is the defaults", () => {
  const file = { "xsm-theme": 3, name: "Night", look: {}, colors: { dark: { acc: "#101010" }, light: { acc: "#202020" } } };
  const r = parseTheme(JSON.stringify(file));
  assert.equal(r.ok, true); assert.equal(r.themes.length, 2); assert.deepEqual(r.themes.map(t => t.side), ["dark", "light"]); assert.equal(r.themes[1].look.colors.acc, "#202020");
  const one = parseTheme(JSON.stringify({ ...file, colors: { dark: { acc: "#101010" }, light: {} } }));
  assert.equal(one.themes.length, 1); assert.equal(one.theme.name, "Night");
});
