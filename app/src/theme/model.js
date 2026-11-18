import { FONT_IDS } from "./fonts.js";
import { isHex, longHex } from "./colors.js";
import { migrateLook } from "./migrate.js";
// The pure part of Customize: what a "look" is and how it is cleaned, merged and read. A look holds only what differs from the built-in dark or light tokens (tokens.css).
//   { colors:  { bg, fg, acc (the three base colours), cpu, ram, good, warn, bad, ... (fine-tuning) }, cb,
//     text:    { machine|group|section|number|label|small: { font, size, weight } }, scale,
//     shape:   { family, radius, border, shadow, scan },
//     surface: { glass, tint, bg, image, grain, os },
//     graph:   { style, width, grid, density, smooth, limits, gradient, glow, dots, axes },
//     layout:  { cols, tabs, heading, density, card },
//     motion:  "off" | "subtle" | "full" }
export const TEXT_LEVELS = [
  { id: "machine", label: "Machine name", size: 15 }, { id: "group", label: "Header", size: 10 }, { id: "section", label: "Section", size: 10 },
  { id: "number", label: "Numbers", size: 16 }, { id: "label", label: "Labels", size: 13 }, { id: "small", label: "Small text", size: 11 },
];
export const LEVEL_IDS = TEXT_LEVELS.map(l => l.id);
export const WEIGHTS = [[0, "Default"], [400, "Regular"], [600, "Semi"], [700, "Bold"]];
export const SIZE_MIN = 8, SIZE_MAX = 32, LINE_MIN = 1, LINE_MAX = 4, SCALE_MIN = 0.8, SCALE_MAX = 1.5, NAME_MAX = 40, FILE_MAX = 1520000;
export const GRAPH_STYLES = [["line", "Line"], ["area", "Area"], ["bars", "Bars"], ["step", "Step"]];
export const GRID_DENSITIES = [["sparse", "Few"], ["normal", "Normal"], ["dense", "Many"]];
export const CARD_SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
export const DENSITIES = [["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]];
export const COLUMNS = [[1, "1"], [2, "2"], [3, "3"]];
export const TAB_STYLES = [["underline", "Underline"], ["pill", "Pill"], ["segmented", "Segmented"]];
export const HEADINGS = [["caps", "CAPS"], ["normal", "Normal"]];
export const GLASS_LEVELS = [["off", "Off (flat)"], ["subtle", "Subtle"], ["full", "Full"]];
export const BACKGROUNDS = [["solid", "Solid"], ["gradient", "Gradient"], ["image", "Image"]];
export const FAMILIES = [["rounded", "Rounded"], ["sharp", "Sharp / Metro"], ["terminal", "Terminal"], ["soft", "Soft"], ["blueprint", "Blueprint"]];
export const BORDERS = [["none", "None"], ["hair", "Hairline"], ["bold", "Bold"]];
// Motion: Full is every effect, Subtle keeps only the quick functional ones (folds, slides), Off is none. The window also stops all motion when Windows asks for less.
export const MOTION_LEVELS = [["full", "Full"], ["subtle", "Subtle"], ["off", "Off"]];
export const PERCENT_MAX = 100, IMAGE_MAX = 1500000;

// Colour items: id, label, the CSS variables it sets, and the dark and light built-in value (a test keeps these equal to tokens.css).
const C = (id, label, vars, dark, light = dark) => ({ id, label, vars, dark, light });
export const BASE_ITEMS = [C("bg", "Background", ["--bg"], "#07080b", "#f3f4f7"), C("fg", "Text", ["--fg"], "#e7e9ee", "#14171c"), C("acc", "Accent", ["--acc"], "#4cc9f0", "#066486")];
export const STATUS_ITEMS = [C("good", "Good", ["--ok"], "#4ade80", "#0e7434"), C("warn", "Warning", ["--warn"], "#f5b544", "#8a5200"), C("bad", "Bad", ["--crit", "--bad"], "#f2637a", "#b3243e")];
export const DERIVED_ITEMS = [C("card", "Card", ["--s1"], "#0d0f14", "#ffffff"), C("s2", "Raised card", ["--s2"], "#13161d", "#eceff4"), C("line", "Border", ["--line"], "#1b1f28", "#e0e4ea"),
  C("line2", "Strong border", ["--line2"], "#282e39", "#c9cfda"), C("dim", "Dim text", ["--dim"], "#9099a8", "#555d6b"), C("mid", "Mid text", ["--mid"], "#aab1bd", "#454d5b"), C("dim2", "Faint text", ["--dim2"], "#4d5462", "#98a0ad")];
export const METRIC_ITEMS = [["cpu", "CPU", "#4ade80"], ["temp", "CPU temperature", "#fb923c"], ["ram", "Memory", "#60a5fa"], ["gpu", "GPU", "#a78bfa"], ["gtemp", "GPU temperature", "#fb5a72"],
  ["vram", "GPU memory", "#38bdf8"], ["down", "Download", "#60a5fa"], ["up", "Upload", "#f472b6"], ["ping", "Ping", "#4cc9f0"], ["disk", "Disk", "#fbbf24"]]
  .map(([id, label, hex]) => C(id, label, ["--c-" + id], hex));
export const ALL_COLORS = [...BASE_ITEMS, ...STATUS_ITEMS, ...DERIVED_ITEMS, ...METRIC_ITEMS];
export const COLOR_IDS = ALL_COLORS.map(c => c.id);
export const builtIn = (id, base) => { const c = ALL_COLORS.find(x => x.id === id); return c ? c[base] : ""; };

// ---- the fields: each setting's path, how a value is checked, and the value the plain window has ----
const bool = v => (typeof v === "boolean" ? v : undefined);
const num = (lo, hi) => v => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
const oneOf = list => { const ids = list.map(x => (Array.isArray(x) ? x[0] : x)); return v => (ids.includes(v) ? v : undefined); };
const hex = v => (isHex(v) ? longHex(v) : undefined);
const image = v => (typeof v === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(v) && v.length <= IMAGE_MAX ? v : undefined);
export const FIELDS = {
  "cb": [bool, false], "scale": [num(SCALE_MIN, SCALE_MAX), 1], "motion": [oneOf(MOTION_LEVELS), "full"],
  "shape.family": [oneOf(FAMILIES), "rounded"], "shape.radius": [num(0, PERCENT_MAX), 35], "shape.border": [oneOf(BORDERS), "hair"], "shape.shadow": [num(0, PERCENT_MAX), 40], "shape.scan": [bool, false],
  "surface.glass": [oneOf(GLASS_LEVELS), "subtle"], "surface.tint": [hex, ""], "surface.bg": [oneOf(BACKGROUNDS), "gradient"], "surface.image": [image, ""], "surface.grain": [num(0, PERCENT_MAX), 0], "surface.os": [bool, false],
  "graph.style": [oneOf(GRAPH_STYLES), "line"], "graph.width": [num(LINE_MIN, LINE_MAX), 2], "graph.grid": [bool, true], "graph.density": [oneOf(GRID_DENSITIES), "normal"], "graph.smooth": [bool, false],
  "graph.limits": [bool, true], "graph.gradient": [bool, false], "graph.glow": [bool, false], "graph.dots": [bool, false], "graph.axes": [bool, true],
  "layout.cols": [oneOf(COLUMNS), 1], "layout.tabs": [oneOf(TAB_STYLES), "underline"], "layout.heading": [oneOf(HEADINGS), "caps"], "layout.density": [oneOf(DENSITIES), "comfortable"], "layout.card": [oneOf(CARD_SIZES), "medium"],
};
const nonEmpty = o => Object.keys(o).length > 0;
export const getPath = (look, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), look);
// A copy of `look` with the value at `path` set; undefined removes it and tidies empty parents away.
export function setPath(look, path, value) {
  const [head, ...rest] = path, cur = look && typeof look === "object" ? look : {}, next = { ...cur };
  const child = rest.length ? setPath(cur[head], rest, value) : value;
  if (child === undefined || (typeof child === "object" && !nonEmpty(child))) delete next[head]; else next[head] = child;
  return next;
}
// What each style family starts with for corner radius, borders and shadow (Rounded is today's look); the person's own choice still wins.
export const FAMILY_DEFAULTS = { rounded: { radius: 35, border: "hair", shadow: 40 }, sharp: { radius: 0, border: "hair", shadow: 0 }, terminal: { radius: 0, border: "hair", shadow: 0 }, soft: { radius: 60, border: "none", shadow: 80 }, blueprint: { radius: 0, border: "hair", shadow: 0 } };
// The value of a setting in `look`, or what its style family or the plain window has.
export function valueOf(look, field) {
  const own = getPath(look, field.split("."));
  if (own !== undefined) return own;
  const fam = field.startsWith("shape.") && field !== "shape.family" ? FAMILY_DEFAULTS[getPath(look, ["shape", "family"])]?.[field.slice(6)] : undefined;
  return fam !== undefined ? fam : FIELDS[field][1];
}
const groupOf = (look, g) => Object.fromEntries(Object.keys(FIELDS).filter(f => f.startsWith(g + ".")).map(f => [f.slice(g.length + 1), valueOf(look, f)]));
export const graphOf = look => groupOf(look, "graph");
export const shapeOf = look => groupOf(look, "shape");
export const surfaceOf = look => groupOf(look, "surface");
export const layoutOf = look => groupOf(look, "layout");

// Whatever was saved or imported (this version or an older one), turned into a clean sparse look. Unknown keys and bad values are dropped.
export function normLook(raw) {
  const r = migrateLook(raw);
  let out = {};
  for (const [field, [check]] of Object.entries(FIELDS)) { const path = field.split("."), v = check(getPath(r, path)); if (v !== undefined) out = setPath(out, path, v); }
  for (const id of LEVEL_IDS) {
    const t = r.text?.[id] || {};
    const one = { font: oneOf(FONT_IDS)(t.font), size: num(SIZE_MIN, SIZE_MAX)(t.size), weight: oneOf(WEIGHTS)(t.weight) };
    for (const [k, v] of Object.entries(one)) out = setPath(out, ["text", id, k], v);
  }
  for (const id of COLOR_IDS) out = setPath(out, ["colors", id], hex(r.colors?.[id]));
  return out;
}
// Every setting of a look as { "colors.acc": "#fff", ... }, and back.
export function flatten(look, prefix = "") {
  return Object.entries(look || {}).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, prefix + k + ".") : [[prefix + k, v]]));
}
export const unflatten = pairs => pairs.reduce((o, [k, v]) => setPath(o, k.split("."), v), {});
// `over` on top of `base`, setting by setting.
export const mergeLook = (base, over) => normLook(unflatten([...flatten(normLook(base)), ...flatten(normLook(over))]));
// What differs between two looks: the paths whose values are not equal.
export const changedPaths = (a, b) => { const x = Object.fromEntries(flatten(normLook(a))), y = Object.fromEntries(flatten(normLook(b))); return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(k => x[k] !== y[k]); };
