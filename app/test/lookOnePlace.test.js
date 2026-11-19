import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAMILIES, setPath } from "../src/theme/model.js";
import { lookToCss, colorMap, fullColors } from "../src/theme/css.js";
import { baseOf } from "../src/theme/model.js";
import { deriveColors, contrast, MIN_FAINT } from "../src/theme/colors.js";
import { pruneEdits } from "../src/theme/edits.js";
import { lookFor } from "../src/theme/appearance.js";
import { PRESETS, resolveTheme, migratePrefs, LARGE_SCALE } from "../src/theme/presets.js";
import { familyEdits } from "../src/customize/family.js";
import { buildCommands } from "../src/commands.js";

const text = f => readFileSync(new URL(f, import.meta.url), "utf8");
const preset = id => PRESETS.find(p => p.id === id);
const lk = id => lookFor(preset(id), {});
const applyPairs = (look, pairs) => pairs.reduce((l, [p, v]) => setPath(l, p.split("."), v), look);
const colourVars = vars => Object.fromEntries(Object.entries(vars).filter(([k]) => /^--(bg|fg|acc|s1|s2|line|line2|dim|mid|dim2|ok|warn|crit|bad|c-|on-acc|tip-bg|blob-a|glass-tint)/.test(k)));

test("switching the style family never changes a colour or the glass", () => {
  for (const base of [{}, lk("nord"), lk("solarized-light"), lk("terminal")]) {
    const before = lookToCss(base);
    for (const [id] of FAMILIES) {
      const after = lookToCss(applyPairs(base, familyEdits(id)));
      assert.deepEqual(colourVars(after.vars), colourVars(before.vars), id);
      assert.equal(after.attrs["data-theme"], before.attrs["data-theme"], id + " light or dark");
      assert.equal(after.attrs["data-glass"], before.attrs["data-glass"], id + " glass");
    }
  }
  for (const [id] of FAMILIES) assert.ok(familyEdits(id).every(([p]) => p.startsWith("shape.")), id + " sets shape settings only");
  assert.equal(familyEdits("sharp")[1][1], false, "leaving Terminal clears the scanlines");
});

test("the Terminal and Blueprint colours live in their themes, not in the style CSS", () => {
  const fx = text("../src/styles/stylefx.css");
  assert.equal(lk("terminal").colors.bg, "#000000"); assert.equal(lk("terminal").colors.fg, "#39ff6a");
  assert.equal(lk("blueprint").colors.bg, "#0b2e63"); assert.equal(preset("blueprint").look.shape.family, "blueprint");
  for (const rule of fx.split("\n").filter(l => /data-family="(terminal|blueprint)"/.test(l) && l.includes("--glass-line"))) assert.match(rule, /:not\(\[data-glass="off"\]\)/, "Glass Off removes the glass edge line");
  assert.ok(!/#39ff6a|#0b2e63/i.test(fx), "no family colours in the style CSS");
  assert.ok(!/#0000005c|#ffffff14|#ffffff0f/i.test(fx), "Soft, Blueprint and the picture dim use the look's own colours");
});

test("the More menu and the Ctrl+K commands have no look controls (Customize is the one place)", () => {
  const menu = text("../src/MoreMenu.jsx");
  assert.ok(!/aria-label="Theme"|aria-label="Text size"|look\.setTheme|look\.setSize|Large text/.test(menu));
  assert.match(menu, /Customize…/);
  const labels = buildCommands({ machines: [], ranges: [], refreshOptions: [], alertPrefs: {}, onCustomize: () => {} }).map(c => c.label);
  assert.ok(!labels.some(l => /^Theme:|^Text size:/.test(l)));
  assert.ok(labels.includes("Open Customize"));
});

test("an edit is kept when it differs from the theme's value, not the global default", () => {
  const term = preset("terminal").look;
  assert.deepEqual(pruneEdits(term, { shape: { family: "rounded" } }), { shape: { family: "rounded" } });   // Rounded works on Terminal
  assert.deepEqual(pruneEdits(preset("dark").look, { shape: { family: "rounded" } }), {});                  // and is no edit on a plain theme
  assert.deepEqual(pruneEdits(term, { shape: { family: "terminal", scan: false } }), { shape: { scan: false } });
  const cb = { cb: true, scale: 1.3, surface: { os: true } };
  assert.deepEqual(pruneEdits(cb, { cb: false, scale: 1, surface: { os: false } }), { cb: false, scale: 1, surface: { os: false } });
  assert.deepEqual(pruneEdits(cb, { cb: true, scale: 1.3 }), {});
  assert.deepEqual(pruneEdits({}, { cb: false, scale: 1, surface: { os: false } }), {});
  assert.deepEqual(pruneEdits({}, { text: { number: { font: "system", size: 16, weight: 0 } } }), {});
  assert.deepEqual(pruneEdits(term, { text: { number: { font: "system" } } }), { text: { number: { font: "system" } } });
  assert.deepEqual(pruneEdits({}, { shape: { family: "sharp", radius: 0 } }), { shape: { family: "sharp" } });   // 0 is Sharp's own corner; the 35 default would not be
  assert.deepEqual(pruneEdits(term, { shape: { radius: 35 } }), { shape: { radius: 35 } });
});

test("light or dark follows the background that is really shown, never a stored choice", () => {
  assert.equal(baseOf({}), "dark"); assert.equal(baseOf({}, "light"), "light");
  assert.equal(baseOf({ colors: { bg: "#ffffff" } }, "dark"), "light"); assert.equal(baseOf({ colors: { bg: "#000000" } }, "light"), "dark");
  assert.equal(lookToCss(lk("terminal")).attrs["data-theme"], "dark");
  assert.equal(lookToCss(lk("solarized-light")).attrs["data-theme"], "light");
  assert.equal(lookToCss(lk("default-light"), { base: "light" }).attrs["data-theme"], "light");
  assert.equal(lookToCss({ colors: { bg: "#101010" } }, { base: "light" }).attrs["data-theme"], "dark");
  const lightOnDark = resolveTheme([], "dark", { dark: { colors: { bg: "#fafafa" } } }).look;
  assert.equal(lookToCss(lightOnDark, { base: "dark" }).attrs["data-theme"], "light");
  assert.equal(fullColors(lightOnDark, "dark").fg, "#14171c", "the plain light text colour goes with a light background");
  assert.equal(colorMap({ cb: true, colors: { bg: "#fafafa" } }, "dark").good, "#0072b2");
});

test("the faintest text keeps a readable floor on every theme", () => {
  for (const p of PRESETS) {
    const s = p.side, c = fullColors(lookFor(p, {}), s);
    for (const on of [c.bg, c.card]) assert.ok(contrast(c.dim2, on) >= MIN_FAINT - 0.01, p.id + " " + s + " faint text on " + on);
  }
  const d = deriveColors({ bg: "#000000", fg: "#39ff6a" });
  assert.ok(contrast(d.dim2, "#000000") >= MIN_FAINT);
});

test("older theme and text size settings become part of the one look, once", () => {
  const none = { themes: [], themeId: "", edits: {} };
  const light = migratePrefs({ ...none, theme: "light" });
  assert.equal(light.themeId, "default-light"); assert.equal(light.appearance, "one");
  const sys = migratePrefs({ ...none, theme: "system" });
  assert.deepEqual(sys.editsBy.dark, { surface: { os: true } }); assert.equal(sys.appearance, "system");
  assert.deepEqual(migratePrefs({ ...none, size: "large" }).editsBy.dark, { scale: LARGE_SCALE });
  assert.deepEqual(migratePrefs({ themes: [], themeId: "nord", edits: { scale: 1.2 }, size: "large" }).editsBy.nord, { scale: 1.39 });
  assert.equal(migratePrefs({ themes: [], themeId: "nord", edits: { scale: 1.5 }, size: "large" }).editsBy.nord.scale, 1.5);
  const keep = migratePrefs({ themes: [], themeId: "dracula", edits: { graph: { style: "bars" } }, theme: "dark", size: "normal", mode: "dark" });
  assert.equal(keep.themeId, "dracula"); assert.deepEqual(keep.editsBy, { dracula: { graph: { style: "bars" } } });
});
