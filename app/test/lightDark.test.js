import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, resolveTheme, migratePrefs, makeTheme, bake } from "../src/theme/presets.js";
import { sideOf, cleanMode, normEdits, lookFor, hasEdits, MODES } from "../src/theme/modes.js";
import { pruneAll } from "../src/theme/edits.js";
import { startHistory, record, undo } from "../src/theme/history.js";
import { lookToCss } from "../src/theme/css.js";
import { setPath } from "../src/theme/model.js";

const by = id => PRESETS.find(p => p.id === id);
const none = { themes: [], themeId: "", edits: {} };

test("mode: Dark, Light or Windows, and Windows follows the system", () => {
  assert.deepEqual(MODES.map(m => m[0]), ["dark", "light", "system"]);
  assert.equal(sideOf("dark", true), "dark"); assert.equal(sideOf("light", false), "light");
  assert.equal(sideOf("system", true), "light"); assert.equal(sideOf("system", false), "dark");
  assert.equal(cleanMode("nonsense"), "dark"); assert.equal(cleanMode("system"), "system");
  const dark = lookToCss(resolveTheme([], "nord", {}, "dark").look, { base: "dark" }), light = lookToCss(resolveTheme([], "nord", {}, "light").look, { base: "light" });
  assert.equal(dark.attrs["data-theme"], "dark"); assert.equal(light.attrs["data-theme"], "light");
  assert.equal(light.vars["--bg"], "#eceff4"); assert.equal(dark.vars["--bg"], "#2e3440");
});

test("each version is edited on its own; shared settings change both; unchanged picks are dropped", () => {
  const nord = by("nord"), edits = { colors: { light: { acc: "#112233" } }, graph: { style: "bars" } };
  assert.equal(lookFor(nord, edits, "light").colors.acc, "#112233"); assert.equal(lookFor(nord, edits, "dark").colors.acc, "#88c0d0");
  assert.equal(lookFor(nord, edits, "dark").graph.style, "bars"); assert.equal(lookFor(nord, edits, "light").graph.style, "bars");
  assert.deepEqual(pruneAll(nord, { colors: { dark: { acc: "#88c0d0" }, light: { acc: "#112233" } } }), { colors: { light: { acc: "#112233" } } });
  assert.deepEqual(pruneAll(nord, { colors: { dark: { acc: "#88c0d0" } }, shape: { family: "rounded" } }), {});
  assert.equal(hasEdits({}), false); assert.equal(hasEdits(edits), true);
});

test("undo covers both versions' edits", () => {
  let h = startHistory({ id: "nord", edits: {} });
  h = record(h, { id: "nord", edits: setPath({}, ["colors", "dark", "bg"], "#101010") }, "a");
  h = record(h, { id: "nord", edits: setPath(h.present.edits, ["colors", "light", "bg"], "#fafafa") }, "b");
  assert.equal(h.present.edits.colors.light.bg, "#fafafa");
  h = undo(h); assert.equal(h.present.edits.colors.light, undefined); assert.equal(h.present.edits.colors.dark.bg, "#101010");
  assert.deepEqual(undo(h).present.edits, {});
});

test("saving keeps both versions; the untouched one is the base theme's twin", () => {
  const nord = by("nord"), edits = { colors: { dark: { acc: "#123456" } }, shape: { family: "soft" } };
  const mine = makeTheme([], "Mine", bake(nord, edits));
  assert.equal(mine.colors.dark.acc, "#123456"); assert.equal(mine.colors.light.bg, "#eceff4"); assert.equal(mine.look.shape.family, "soft"); assert.equal(mine.look.colors, undefined);
  assert.equal(resolveTheme([mine], mine.id, {}, "light").look.colors.fg, "#2e3440");
  assert.equal(bake(undefined, { colors: { light: { acc: "#fff" } } }).colors.light.acc, "#ffffff");
});

test("older settings become a mode: light theme, light background, Match Windows", () => {
  const light = migratePrefs({ ...none, theme: "light" });
  assert.equal(light.mode, "light"); assert.equal(light.themeId, "");
  const folded = migratePrefs({ ...none, themeId: "light" });
  assert.equal(folded.mode, "light"); assert.equal(folded.themeId, "dark", "the old Light theme is Dark's light version");
  assert.deepEqual([migratePrefs({ ...none, themeId: "solarized-light" }).themeId, migratePrefs({ ...none, themeId: "solarized-light" }).mode], ["solarized", "light"]);
  assert.deepEqual([migratePrefs({ ...none, themeId: "catppuccin-latte" }).themeId, migratePrefs({ ...none, themeId: "catppuccin-latte" }).mode], ["catppuccin", "light"]);
  assert.deepEqual([migratePrefs({ ...none, themeId: "catppuccin-mocha" }).themeId, migratePrefs({ ...none, themeId: "catppuccin-mocha" }).mode], ["catppuccin", "dark"]);
  const os = migratePrefs({ ...none, themeId: "nord", edits: { surface: { os: true } } });
  assert.equal(os.mode, "system"); assert.equal(os.edits.surface.os, true, "the accent colour part stays");
  assert.equal(migratePrefs({ ...none, theme: "system" }).mode, "system");
  assert.equal(migratePrefs({ ...none, themeId: "dracula" }).mode, "dark");
  const mine = { id: "my-x", name: "X", base: "light", look: { colors: { bg: "#fafafa", acc: "#102030" }, graph: { style: "step" } } };
  const user = migratePrefs({ themes: [mine], themeId: "my-x", edits: {} });
  assert.equal(user.mode, "light"); assert.equal(user.themes[0].colors.light.bg, "#fafafa"); assert.equal(user.themes[0].look.graph.style, "step");
  const edited = migratePrefs({ ...none, themeId: "dracula", edits: { colors: { bg: "#ffffff", acc: "#0000aa" }, graph: { style: "bars" } } });
  assert.equal(edited.mode, "light", "a light background was showing"); assert.equal(edited.edits.colors.light.bg, "#ffffff"); assert.equal(edited.edits.graph.style, "bars");
  assert.equal(normEdits({ colors: { acc: "#0000aa" } }, "dark").colors.dark.acc, "#0000aa");
});

test("migrating twice changes nothing, and a saved mode is kept", () => {
  const once = migratePrefs({ ...none, themeId: "solarized-light", edits: { colors: { acc: "#0000aa" } } });
  const again = migratePrefs({ themes: once.themes, themeId: once.themeId, edits: once.edits, mode: once.mode });
  assert.equal(again.changed, false); assert.deepEqual(again.edits, once.edits); assert.equal(again.mode, "light");
  assert.equal(migratePrefs({ ...none, themeId: "nord", mode: "system" }).mode, "system");
  assert.equal(migratePrefs({ ...none, mode: "bogus" }).mode, "dark");
});
