import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_COLORS, normLook, mergeLook, setPath, getPath, flatten, changedPaths, graphOf, layoutOf, valueOf } from "../src/theme/model.js";
import { lookToCss, contrastWarning, colorMap, fullColors, radiusK, shadowK } from "../src/theme/css.js";
import { contrast, deriveColors, mix, isLight, readable } from "../src/theme/colors.js";
import { parseTheme, exportTheme, normTheme, newId } from "../src/theme/files.js";
import { migrateLook, migrateThemeId } from "../src/theme/migrate.js";
import { startHistory, record, undo, redo, canUndo, canRedo, HISTORY_LIMIT } from "../src/theme/history.js";
import { matches, activeSection, SECTIONS } from "../src/customize/find.js";
import { PRESETS, resolveTheme, makeTheme, cleanSaved, themeTitle, isCustom, migrateStored } from "../src/theme/presets.js";
import { FONTS, fontStack } from "../src/theme/fonts.js";
import { seriesPaths } from "../src/theme/graphStyle.js";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const block = sel => css.slice(css.indexOf(sel), css.indexOf("}", css.indexOf(sel)));
const tokenOf = (b, v) => b.match(new RegExp("(?:^|[\\s;{])" + v.replace(/-/g, "\\-") + ":\\s*(#[0-9a-fA-F]{3,6})"))?.[1].toLowerCase();

test("the built-in colour table matches tokens.css for dark and light", () => {
  const dark = block(":root {"), light = block(':root[data-theme="light"]');
  for (const c of ALL_COLORS) {
    assert.equal(tokenOf(dark, c.vars[0]), c.dark, c.id + " dark");
    const l = tokenOf(light, c.vars[0]);
    assert.equal(l || c.dark, c.light, c.id + " light");
  }
});

test("every bundled font has a face for regular and bold in fonts.css", () => {
  const faces = readFileSync(new URL("../src/styles/fonts.css", import.meta.url), "utf8");
  for (const f of FONTS.filter(x => x.stack)) for (const w of [400, 700]) assert.ok(faces.includes(`font-family:"${f.label}";font-style:normal;font-weight:${w}`), f.label + " " + w);
  assert.equal(fontStack("system"), ""); assert.equal(fontStack("nope"), "");
  assert.match(fontStack("jetbrains-mono"), /monospace$/);
});

test("normLook drops unknown keys and bad values, clamps numbers, expands short hex", () => {
  const l = normLook({ junk: 1, text: { machine: { font: "inter", size: 99, weight: 700 }, small: { font: "comic" }, nope: { size: 12 } }, colors: { acc: "#abc", bg: "red", zzz: "#000000" }, graph: { style: "waves", width: 0, grid: false, smooth: "yes", dots: true },
    shape: { family: "terminal", radius: 500, border: "dotted" }, surface: { image: "http://x/y.png", grain: -4 }, layout: { cols: 3, tabs: "pill" }, scale: 2, cb: true });
  assert.deepEqual(l, { text: { machine: { font: "inter", size: 32, weight: 700 } }, colors: { acc: "#aabbcc" }, graph: { width: 1, grid: false, dots: true }, shape: { family: "terminal", radius: 100 }, surface: { grain: 0 }, layout: { cols: 3, tabs: "pill" }, scale: 1.5, cb: true });
  assert.deepEqual(normLook(null), {}); assert.deepEqual(normLook("x"), {}); assert.deepEqual(normLook({ text: { machine: { size: NaN } } }), {});
  assert.equal(normLook({ surface: { image: "data:image/png;base64,iVBORw0KGgo=" } }).surface.image, "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(normLook({ surface: { image: "data:text/html;base64,AAAA" } }).surface, undefined);
});

test("older looks are migrated: size and glass move to layout, scale and surface; a renamed theme keeps working", () => {
  const old = { size: { card: "large", density: "compact", scale: 1.2 }, glass: "off", colors: { acc: "#ffe600", card: "#101010" }, graph: { style: "area" } };
  assert.deepEqual(normLook(old), { colors: { acc: "#ffe600", card: "#101010" }, graph: { style: "area" }, layout: { card: "large", density: "compact" }, scale: 1.2, surface: { glass: "off" } });
  assert.deepEqual(migrateLook(null), {}); assert.deepEqual(migrateLook({ size: {} }).layout, {});
  assert.equal(migrateLook({ size: { scale: 1.1 }, scale: 1.3 }).scale, 1.3);
  assert.equal(migrateThemeId("solarized"), "solarized-dark"); assert.equal(migrateThemeId("my-x"), "my-x");
  assert.equal(resolveTheme([], "solarized", {}).theme.id, "solarized-dark");
  const m = migrateStored({ themes: [{ id: "my-a", name: "A", base: "dark", look: old }, 5], themeId: "solarized", edits: old });
  assert.equal(m.changed, true); assert.equal(m.themeId, "solarized-dark"); assert.equal(m.themes.length, 1); assert.equal(m.themes[0].look.surface.glass, "off"); assert.equal(m.edits.layout.card, "large");
  assert.equal(migrateStored(m).changed, false);
  assert.equal(migrateStored({ themes: undefined, themeId: 5, edits: undefined }).themeId, "");
  assert.equal(parseTheme(JSON.stringify({ "xsm-theme": 1, name: "Old", look: old })).ok, true);
});

test("mergeLook puts the second look over the first, setting by setting", () => {
  const m = mergeLook({ text: { machine: { font: "inter", size: 20 } }, colors: { acc: "#111111" } }, { text: { machine: { size: 18 }, small: { size: 9 } }, colors: { bg: "#000000" }, graph: { grid: false } });
  assert.deepEqual(m, { text: { machine: { font: "inter", size: 18 }, small: { size: 9 } }, colors: { acc: "#111111", bg: "#000000" }, graph: { grid: false } });
  assert.deepEqual(mergeLook(undefined, undefined), {});
  assert.deepEqual(flatten({ a: { b: 1 }, c: 2 }), [["a.b", 1], ["c", 2]]);
  assert.deepEqual(changedPaths({ cb: true, motion: "off" }, { motion: "off", scale: 1.1 }).sort(), ["cb", "scale"]); assert.deepEqual(changedPaths(undefined, {}), []);
});

test("setPath sets, removes and tidies empty parents; getPath reads; valueOf falls back to the plain window", () => {
  let e = setPath({}, ["text", "machine", "size"], 18);
  assert.equal(getPath(e, ["text", "machine", "size"]), 18);
  e = setPath(e, ["colors", "acc"], "#ffffff");
  e = setPath(e, ["text", "machine", "size"], undefined);
  assert.deepEqual(e, { colors: { acc: "#ffffff" } });
  assert.deepEqual(setPath(null, ["a"], undefined), {});
  assert.equal(getPath({}, ["a", "b"]), undefined);
  assert.equal(valueOf({}, "shape.radius"), 35); assert.equal(valueOf({ shape: { radius: 0 } }, "shape.radius"), 0);
  assert.deepEqual(graphOf({}), { style: "line", width: 2, grid: true, density: "normal", smooth: false, limits: true, gradient: false, glow: false, dots: false, axes: true });
  assert.equal(layoutOf({ layout: { cols: 2 } }).cols, 2); assert.equal(layoutOf(undefined).density, "comfortable");
});

test("three base colours give every other colour, and dim text always reads", () => {
  const bases = [["#07080b", "#e7e9ee"], ["#f3f4f7", "#14171c"], ["#282a36", "#f8f8f2"], ["#fdf6e3", "#073642"], ["#112233", "#aaaaaa"], ["#ffffff", "#000000"]];
  for (const [bg, fg] of bases) {
    const d = deriveColors({ bg, fg });
    for (const k of ["card", "s2"]) for (const t of ["dim", "mid"]) assert.ok(contrast(d[t], d[k]) >= 4.5, `${bg} ${t} on ${k}`);
    assert.ok(contrast(d.dim, bg) >= 4.5, bg + " dim on bg"); assert.notEqual(d.line, bg);
  }
  assert.equal(isLight("#f3f4f7"), true); assert.equal(isLight("#07080b"), false);
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080"); assert.equal(readable("#777777", "#ffffff", ["#000000"]), "#777777");
});

test("lookToCss gives variables, derived colours, text levels, graph, layout and shape values", () => {
  const { vars, attrs } = lookToCss(normLook({ colors: { acc: "#ffe600", card: "#101010", bad: "#ff0000", bg: "#000000" }, text: { machine: { font: "lato", size: 18, weight: 700 } }, graph: { style: "area", width: 3, grid: false, limits: false }, layout: { card: "large", density: "compact", cols: 2 }, scale: 1.1, shape: { radius: 0, border: "bold", family: "sharp" }, surface: { tint: "#334455", grain: 50 } }));
  assert.equal(vars["--acc"], "#ffe600"); assert.equal(vars["--on-acc"], "#000000"); assert.equal(vars["--blob-a"], "#ffe6002e");
  assert.equal(vars["--s1"], "#101010"); assert.equal(vars["--tip-bg"], "#101010"); assert.match(vars["--s2"], /^#[0-9a-f]{6}$/); assert.match(vars["--line"], /^#[0-9a-f]{6}$/);
  assert.equal(vars["--crit"], "#ff0000"); assert.equal(vars["--bad"], "#ff0000");
  assert.equal(vars["--font-machine"], '"Lato", system-ui, sans-serif'); assert.equal(vars["--size-machine"], "calc(18px * var(--scale))"); assert.equal(vars["--weight-machine"], "700");
  assert.equal(vars["--line-w"], "3"); assert.equal(vars["--area-op"], "0.3"); assert.equal(vars["--graph-k"], "1.4"); assert.equal(vars["--dens"], "0.85"); assert.equal(vars["--scale"], "1.1");
  assert.equal(vars["--rk"], "0"); assert.equal(vars["--bw"], "2px"); assert.equal(vars["--glass-tint"], "#334455"); assert.equal(vars["--grain"], "0.5");
  assert.equal(attrs["data-grid"], "off"); assert.equal(attrs["data-limits"], "off"); assert.equal(attrs["data-cols"], "2"); assert.equal(attrs["data-family"], "sharp"); assert.equal(attrs["data-border"], "bold");
  const plain = lookToCss({}), large = lookToCss({}, { large: true }), both = lookToCss({ scale: 1.5 }, { large: true });
  assert.equal(plain.vars["--scale"], undefined); assert.equal(large.vars["--scale"], undefined); assert.equal(both.vars["--scale"], "1.74");
  assert.equal(plain.vars["--area-op"], "0.08"); assert.equal(plain.attrs["data-glass"], "subtle"); assert.equal(plain.attrs["data-motion"], "full"); assert.equal(plain.attrs["data-tabs"], "underline"); assert.equal(plain.attrs["data-heading"], "caps");
  assert.equal(lookToCss({ colors: { acc: "#0a0a0a" } }).vars["--on-acc"], "#ffffff");
  assert.equal(lookToCss({ motion: "off" }).attrs["data-motion"], "off"); assert.equal(lookToCss({ surface: { glass: "off" } }).attrs["data-glass"], "off");
  assert.equal(radiusK(0), 0); assert.equal(radiusK(35), 1); assert.equal(radiusK(100), 8); assert.ok(radiusK(70) > 1 && radiusK(70) < 8); assert.equal(shadowK(40), 1); assert.equal(shadowK(0), 0);
});

test("colour-blind safe swaps the status colours and a light background gets darker ones", () => {
  assert.deepEqual(colorMap({ cb: true }, "dark"), { good: "#56b4e9", warn: "#e69f00", bad: "#d55e00" });
  assert.equal(colorMap({ cb: true, colors: { bg: "#ffffff" } }, "dark").good, "#0072b2");
  assert.equal(colorMap({ cb: true, colors: { bad: "#ff0000" } }, "dark").bad, "#ff0000");
  assert.equal(lookToCss({ cb: true }).attrs["data-cb"], "on"); assert.equal(lookToCss({}).attrs["data-cb"], "off");
  assert.deepEqual(colorMap({}, "dark"), {}); assert.equal(fullColors({}, "light").bg, "#f3f4f7"); assert.equal(fullColors({ colors: { bg: "#000000" } }, "light").bg, "#000000");
});

test("contrast follows WCAG and the warning shows under 4.5", () => {
  assert.equal(contrast("#000000", "#ffffff").toFixed(1), "21.0"); assert.equal(contrast("#fff", "#fff"), 1);
  assert.equal(contrastWarning({}, "dark"), ""); assert.equal(contrastWarning({}, "light"), "");
  assert.match(contrastWarning({ colors: { fg: "#777777", bg: "#888888" } }, "dark"), /hard to read \(contrast 1\.\d/);
  for (const p of PRESETS) {
    assert.equal(contrastWarning(p.look, p.base), "", p.id + " text is readable");
    const c = fullColors(p.look, p.base);
    assert.ok(contrast(c.fg, c.bg) >= 4.5 && contrast(c.dim, c.card) >= 4.5, p.id + " contrast");
    assert.ok(contrast(c.acc, c.bg) >= 3, p.id + " accent is visible");
  }
});

test("presets: six built-in themes and eight popular palettes with the published colours; resolveTheme merges edits on top", () => {
  assert.deepEqual(PRESETS.map(p => p.id), ["dark", "light", "midnight", "contrast", "neon", "terminal", "dracula", "nord", "catppuccin-mocha", "gruvbox", "tokyo-night", "solarized-dark", "solarized-light", "catppuccin-latte"]);
  const by = id => PRESETS.find(p => p.id === id);
  assert.equal(by("dracula").look.colors.bg, "#282a36"); assert.equal(by("nord").look.colors.bg, "#2e3440"); assert.equal(by("catppuccin-mocha").look.colors.bg, "#1e1e2e"); assert.equal(by("catppuccin-latte").look.colors.fg, "#4c4f69");
  assert.equal(by("tokyo-night").look.colors.bg, "#1a1b26"); assert.equal(by("solarized-dark").look.colors.bg, "#002b36"); assert.equal(by("gruvbox").look.colors.fg, "#ebdbb2");
  assert.deepEqual(PRESETS.filter(p => p.base === "light").map(p => p.id), ["light", "solarized-light", "catppuccin-latte"]);
  assert.equal(by("terminal").look.shape.family, "terminal"); assert.equal(by("terminal").look.shape.scan, true); assert.equal(by("terminal").look.text.number.font, "jetbrains-mono");
  const r = resolveTheme([], "midnight", { colors: { acc: "#123456" } });
  assert.equal(r.look.colors.acc, "#123456"); assert.equal(r.look.colors.bg, "#05070f"); assert.equal(r.theme.name, "Midnight");
  assert.equal(resolveTheme([], "gone", {}).theme, null);
  const mine = makeTheme([], "  Evening ", "dark", r.look);
  assert.equal(mine.id, "my-evening"); assert.equal(mine.name, "Evening"); assert.equal(makeTheme([mine], "Evening", "dark", {}).id, "my-evening-2"); assert.equal(makeTheme([], "  ", "dark", {}).name, "My theme");
  assert.deepEqual(cleanSaved([mine, { id: "dark", name: "x" }, { name: "no id" }, 5]).map(t => t.id).slice(0, 1), ["my-evening"]);
  assert.deepEqual(cleanSaved("x"), []);
  assert.equal(themeTitle(by("nord"), false), "Nord"); assert.equal(themeTitle(by("nord"), true), "Custom (based on Nord)"); assert.equal(themeTitle(null, true), "Custom (based on Dark)");
  assert.equal(isCustom(by("nord"), by("nord").look), false); assert.equal(isCustom(by("nord"), r.look), true); assert.equal(isCustom(null, {}), false);
});

test("export then parse gives the same theme back; bad files get a friendly error", () => {
  const t = normTheme({ id: "a", name: "Night", base: "light", look: { colors: { acc: "#101010" }, graph: { style: "step" }, shape: { family: "soft" } } });
  const back = parseTheme(exportTheme(t));
  assert.equal(back.ok, true); assert.deepEqual({ ...back.theme, id: "a" }, t);
  for (const [text, re] of [["", /Paste/], ["{nope", /not valid JSON/], ["[]", /not a theme/], ['{"xsm-theme":9,"look":{"cb":true}}', /not a theme/], ['{"xsm-theme":2,"look":{"x":1}}', /nothing in it/], ["x".repeat(1600000), /too long/], [null, /Paste/]]) {
    const r = parseTheme(text); assert.equal(r.ok, false); assert.match(r.error, re);
  }
  assert.deepEqual(normTheme(null), { id: "", name: "Untitled", base: "dark", look: {} });
  assert.equal(normTheme({ name: "x".repeat(99) }).name.length, 40);
  assert.equal(newId("!!!", []), "my-theme");
});

test("undo and redo walk the steps; one slider drag is one step; the list is bounded", () => {
  let h = startHistory("a");
  assert.equal(canUndo(h), false); assert.equal(canRedo(h), false); assert.equal(undo(h), h); assert.equal(redo(h), h); assert.equal(record(h, "a"), h);
  h = record(h, "b"); h = record(h, "c", "scale"); h = record(h, "d", "scale");
  assert.deepEqual(h.past, ["a", "b"]); assert.equal(h.present, "d");
  h = undo(h); assert.equal(h.present, "b"); assert.equal(canRedo(h), true);
  h = redo(h); assert.equal(h.present, "d");
  h = undo(h); h = record(h, "x"); assert.equal(canRedo(h), false);
  let big = startHistory(0); for (let i = 1; i < HISTORY_LIMIT + 20; i++) big = record(big, i); assert.equal(big.past.length, HISTORY_LIMIT);
});

test("search matches every word against label, keywords and id; the scroll spy picks the section reached", () => {
  assert.equal(matches("corner", "Corner radius", "round"), true); assert.equal(matches("glass blur", "Glass", "frosted blur"), true); assert.equal(matches("nope", "Glass"), false); assert.equal(matches("", "x"), true); assert.equal(matches("  ", "x"), true);
  const ids = SECTIONS.map(s => s[0]), tops = ids.map((_, i) => i * 100);
  assert.equal(activeSection(ids, tops, 0), "theme"); assert.equal(activeSection(ids, tops, 250), ids[2]); assert.equal(activeSection(ids, tops, 9999), ids[ids.length - 1]);
});

test("seriesPaths: line, smooth, area, step and bars", () => {
  const o = { x: t => t * 10, y: v => 100 - v, bottom: 100 }, pts = [[0, 10], [1, 50], [2, 30]];
  assert.equal(seriesPaths([[0, 1]], o), null);
  const line = seriesPaths(pts, o);
  assert.equal(line.l, "M0.0 90.0L10.0 50.0L20.0 70.0"); assert.equal(line.a, line.l + "L20.0 100.0L0.0 100.0Z");
  const sm = seriesPaths(pts, { ...o, smooth: true });
  assert.match(sm.l, /^M0\.0 90\.0C.*C.* 20\.0 70\.0$/);
  const wild = seriesPaths([[0, 0], [1, 100], [2, 0]], { ...o, smooth: true }).l;
  assert.ok(!/ -\d/.test(wild), "curves never leave the plot");
  assert.equal(seriesPaths(pts, { ...o, style: "step" }).l, "M0.0 90.0H10.0V50.0H20.0V70.0");
  const bars = seriesPaths(pts, { ...o, style: "bars" });
  assert.equal(bars.a, ""); assert.equal(bars.l.split("Z").length - 1, 3); assert.match(bars.l, /^M-3\.5 100\.0V90\.0h7\.0V100\.0Z/);
});
