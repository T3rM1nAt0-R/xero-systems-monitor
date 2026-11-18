import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_COLORS, normLook, mergeLook, setPath, getPath, lookToCss, contrast, contrastWarning, parseTheme, exportTheme, normTheme, newId, graphOf, sizeOf } from "../src/theme/model.js";
test("glass defaults to subtle, is written as data-glass, and is cleaned and merged", () => {
  assert.equal(lookToCss({}).attrs["data-glass"], "subtle");
  assert.equal(lookToCss({ glass: "off" }).attrs["data-glass"], "off");
  assert.equal(normLook({ glass: "melted" }).glass, undefined);
  assert.equal(mergeLook({ glass: "full" }, {}).glass, "full");
  assert.equal(mergeLook({ glass: "full" }, { glass: "off" }).glass, "off");
});
import { PRESETS, resolveTheme, makeTheme, cleanSaved } from "../src/theme/presets.js";
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
  const l = normLook({ junk: 1, text: { machine: { font: "inter", size: 99, weight: 700 }, small: { font: "comic" }, nope: { size: 12 } }, colors: { acc: "#abc", bg: "red", zzz: "#000000" }, graph: { style: "waves", width: 0, grid: false, smooth: "yes" }, size: { card: "large", density: "x", scale: 2 } });
  assert.deepEqual(l, { text: { machine: { font: "inter", size: 32, weight: 700 } }, colors: { acc: "#aabbcc" }, graph: { width: 1, grid: false }, size: { card: "large", scale: 1.5 } });
  assert.deepEqual(normLook(null), {}); assert.deepEqual(normLook("x"), {}); assert.deepEqual(normLook({ text: { machine: { size: NaN } } }), {});
});

test("mergeLook puts the second look over the first, a text level field by field", () => {
  const m = mergeLook({ text: { machine: { font: "inter", size: 20 } }, colors: { acc: "#111111" } }, { text: { machine: { size: 18 }, small: { size: 9 } }, colors: { bg: "#000000" }, graph: { grid: false } });
  assert.deepEqual(m, { text: { machine: { font: "inter", size: 18 }, small: { size: 9 } }, colors: { acc: "#111111", bg: "#000000" }, graph: { grid: false } });
  assert.deepEqual(mergeLook(undefined, undefined), {});
});

test("setPath sets, removes and tidies empty parents; getPath reads", () => {
  let e = setPath({}, ["text", "machine", "size"], 18);
  assert.equal(getPath(e, ["text", "machine", "size"]), 18);
  e = setPath(e, ["colors", "acc"], "#ffffff");
  e = setPath(e, ["text", "machine", "size"], undefined);
  assert.deepEqual(e, { colors: { acc: "#ffffff" } });
  assert.deepEqual(setPath(null, ["a"], undefined), {});
  assert.equal(getPath({}, ["a", "b"]), undefined);
});

test("lookToCss gives variables, derived colours, text levels, graph and size values", () => {
  const { vars, attrs } = lookToCss(normLook({ colors: { acc: "#ffe600", card: "#101010", bad: "#ff0000" }, text: { machine: { font: "lato", size: 18, weight: 700 } }, graph: { style: "area", width: 3, grid: false, limits: false }, size: { card: "large", density: "compact", scale: 1.1 } }));
  assert.equal(vars["--acc"], "#ffe600"); assert.equal(vars["--on-acc"], "#000000");
  assert.equal(vars["--s1"], "#101010"); assert.match(vars["--s2"], /^color-mix/);
  assert.equal(vars["--crit"], "#ff0000"); assert.equal(vars["--bad"], "#ff0000");
  assert.equal(vars["--font-machine"], '"Lato", system-ui, sans-serif'); assert.equal(vars["--size-machine"], "calc(18px * var(--scale))"); assert.equal(vars["--weight-machine"], "700");
  assert.equal(vars["--line-w"], "3"); assert.equal(vars["--area-op"], "0.3"); assert.equal(vars["--graph-k"], "1.4"); assert.equal(vars["--dens"], "0.85"); assert.equal(vars["--scale"], "1.1");
  assert.deepEqual(attrs, { "data-grid": "off", "data-limits": "off", "data-glass": "subtle", "data-motion": "full" });
  const plain = lookToCss({}), large = lookToCss({}, { large: true }), both = lookToCss({ size: { scale: 1.5 } }, { large: true });
  assert.equal(plain.vars["--scale"], undefined); assert.equal(large.vars["--scale"], undefined); assert.equal(both.vars["--scale"], "1.74");
  assert.equal(plain.vars["--area-op"], "0.08"); assert.deepEqual(plain.attrs, { "data-grid": "on", "data-limits": "on", "data-glass": "subtle", "data-motion": "full" });
  assert.equal(lookToCss({ colors: { acc: "#0a0a0a" } }).vars["--on-acc"], "#ffffff");
  assert.equal(lookToCss({ colors: { fg: "#ffffff", dim: "#999999", line: "#222222" } }).vars["--line2"].startsWith("color-mix"), true);
});

test("contrast follows WCAG and the warning shows under 4.5", () => {
  assert.equal(contrast("#000000", "#ffffff").toFixed(1), "21.0"); assert.equal(contrast("#fff", "#fff"), 1);
  assert.equal(contrastWarning({}, "dark"), ""); assert.equal(contrastWarning({}, "light"), "");
  assert.match(contrastWarning({ colors: { fg: "#777777", bg: "#888888" } }, "dark"), /hard to read \(contrast 1\.3/);
  for (const p of PRESETS) assert.equal(contrastWarning(p.look, p.base), "", p.id + " is readable");
});

test("presets: six built-in themes with unique ids; resolveTheme merges edits on top", () => {
  assert.deepEqual(PRESETS.map(p => p.id), ["dark", "light", "midnight", "solarized", "contrast", "neon"]);
  const r = resolveTheme([], "midnight", { colors: { acc: "#123456" } });
  assert.equal(r.look.colors.acc, "#123456"); assert.equal(r.look.colors.bg, "#05070f"); assert.equal(r.theme.name, "Midnight");
  assert.equal(resolveTheme([], "gone", {}).theme, null);
  const mine = makeTheme([], "  Evening ", "dark", r.look);
  assert.equal(mine.id, "my-evening"); assert.equal(mine.name, "Evening"); assert.equal(makeTheme([mine], "Evening", "dark", {}).id, "my-evening-2"); assert.equal(makeTheme([], "  ", "dark", {}).name, "My theme");
  assert.deepEqual(cleanSaved([mine, { id: "dark", name: "x" }, { name: "no id" }, 5]).map(t => t.id).slice(0, 1), ["my-evening"]);
  assert.deepEqual(cleanSaved("x"), []);
});

test("export then parse gives the same theme back; bad files get a friendly error", () => {
  const t = normTheme({ id: "a", name: "Night", base: "light", look: { colors: { acc: "#101010" }, graph: { style: "bars" } } });
  const back = parseTheme(exportTheme(t));
  assert.equal(back.ok, true); assert.deepEqual({ ...back.theme, id: "a" }, t);
  for (const [text, re] of [["", /Paste/], ["{nope", /not valid JSON/], ["[]", /not a theme/], ['{"xsm-theme":1,"look":{"x":1}}', /nothing in it/], ["x".repeat(30000), /too long/], [null, /Paste/]]) {
    const r = parseTheme(text); assert.equal(r.ok, false); assert.match(r.error, re);
  }
  assert.deepEqual(normTheme(null), { id: "", name: "Untitled", base: "dark", look: {} });
  assert.equal(normTheme({ name: "x".repeat(99) }).name.length, 40);
  assert.equal(newId("!!!", []), "my-theme");
});

test("graph and size helpers fill in the defaults", () => {
  assert.deepEqual(graphOf({}), { style: "line", width: 2, grid: true, smooth: false, limits: true });
  assert.equal(sizeOf({ size: { card: "small" } }).card, "small"); assert.equal(sizeOf(undefined).density, "comfortable");
});

test("seriesPaths: line, smooth, area and bars", () => {
  const o = { x: t => t * 10, y: v => 100 - v, bottom: 100 }, pts = [[0, 10], [1, 50], [2, 30]];
  assert.equal(seriesPaths([[0, 1]], o), null);
  const line = seriesPaths(pts, o);
  assert.equal(line.l, "M0.0 90.0L10.0 50.0L20.0 70.0"); assert.equal(line.a, line.l + "L20.0 100.0L0.0 100.0Z");
  const sm = seriesPaths(pts, { ...o, smooth: true });
  assert.match(sm.l, /^M0\.0 90\.0C.*C.* 20\.0 70\.0$/);
  const wild = seriesPaths([[0, 0], [1, 100], [2, 0]], { ...o, smooth: true }).l;
  assert.ok(!/ -\d/.test(wild), "curves never leave the plot");
  const bars = seriesPaths(pts, { ...o, style: "bars" });
  assert.equal(bars.a, ""); assert.equal(bars.l.split("Z").length - 1, 3); assert.match(bars.l, /^M-3\.5 100\.0V90\.0h7\.0V100\.0Z/);
});

test("motion defaults to full, is written as data-motion, and is cleaned and merged", () => {
  assert.equal(lookToCss({}).attrs["data-motion"], "full");
  assert.equal(lookToCss({ motion: "off" }).attrs["data-motion"], "off");
  assert.equal(normLook({ motion: "wild" }).motion, undefined);
  assert.equal(mergeLook({ motion: "subtle" }, {}).motion, "subtle");
  assert.equal(mergeLook({ motion: "subtle" }, { motion: "off" }).motion, "off");
});
