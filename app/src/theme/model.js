import { FONT_IDS, fontStack } from "./fonts.js";
// The pure part of Customize: what a "look" is, how it is cleaned, merged, turned into CSS variables, and how a theme file is read and checked.
// A look is sparse: it holds only what differs from the built-in dark or light tokens (tokens.css).
//   { text:   { machine|section|group|number|label|small: { font, size, weight } },
//     colors: { acc, bg, card, fg, dim, line, warn, bad, good, cpu, temp, ... },
//     graph:  { style, width, grid, smooth, limits },
//     size:   { card, density, scale } }
export const TEXT_LEVELS = [
  { id: "machine", label: "Machine name", size: 15 }, { id: "section", label: "Section header", size: 10 }, { id: "group", label: "Group header", size: 10 },
  { id: "number", label: "Big numbers", size: 16 }, { id: "label", label: "Labels", size: 13 }, { id: "small", label: "Small text", size: 11 },
];
export const LEVEL_IDS = TEXT_LEVELS.map(l => l.id);
export const WEIGHTS = [[0, "Default"], [400, "Regular"], [700, "Bold"]];
export const SIZE_MIN = 8, SIZE_MAX = 32, LINE_MIN = 1, LINE_MAX = 4, SCALE_MIN = 0.8, SCALE_MAX = 1.5, LARGE_SCALE = 1.16, NAME_MAX = 40, FILE_MAX = 20000;
export const GRAPH_STYLES = [["line", "Line"], ["area", "Filled area"], ["bars", "Bars"]];
export const CARD_SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
export const DENSITIES = [["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]];
export const DEFAULT_GRAPH = Object.freeze({ style: "line", width: 2, grid: true, smooth: false, limits: true });
export const DEFAULT_SIZE = Object.freeze({ card: "medium", density: "comfortable", scale: 1 });
const GRAPH_K = { small: 0.75, medium: 1, large: 1.4 }, DENS_K = { compact: 0.85, comfortable: 1, spacious: 1.2 }, AREA_OP = { line: 0.08, area: 0.3, bars: 0 };

// Colour items: id, label, the CSS variables it sets, and the dark and light built-in value (a test keeps these equal to tokens.css).
const C = (id, label, vars, dark, light = dark) => ({ id, label, vars, dark, light });
export const COLOR_ITEMS = [
  C("acc", "Accent", ["--acc"], "#4cc9f0", "#0a7ea4"), C("bg", "Background", ["--bg"], "#07080b", "#f3f4f7"), C("card", "Card", ["--s1"], "#0d0f14", "#ffffff"),
  C("fg", "Text", ["--fg"], "#e7e9ee", "#14171c"), C("dim", "Dim text", ["--dim"], "#7b8392", "#6a7280"), C("line", "Border", ["--line"], "#1b1f28", "#e0e4ea"),
  C("good", "Good", ["--ok"], "#4ade80"), C("warn", "Warning", ["--warn"], "#f5b544", "#b26b00"), C("bad", "Bad", ["--crit", "--bad"], "#f2637a", "#d23b55"),
];
export const METRIC_ITEMS = [["cpu", "CPU", "#4ade80"], ["temp", "CPU temperature", "#fb923c"], ["ram", "Memory", "#60a5fa"], ["gpu", "GPU", "#a78bfa"], ["gtemp", "GPU temperature", "#fb5a72"],
  ["vram", "GPU memory", "#38bdf8"], ["down", "Download", "#60a5fa"], ["up", "Upload", "#f472b6"], ["ping", "Ping", "#4cc9f0"], ["disk", "Disk", "#fbbf24"]]
  .map(([id, label, hex]) => C(id, label, ["--c-" + id], hex));
export const ALL_COLORS = [...COLOR_ITEMS, ...METRIC_ITEMS];
export const COLOR_IDS = ALL_COLORS.map(c => c.id);
// Values that follow from a colour the person set, so the rest of the window stays in tune with it.
const MIX = (a, pa, b) => `color-mix(in srgb,var(${a}) ${pa}%,var(${b}))`;
const DERIVED = { card: { "--s2": MIX("--s1", 94, "--fg"), "--tip-bg": "var(--s1)" }, fg: { "--mid": MIX("--fg", 55, "--dim") }, dim: { "--mid": MIX("--fg", 55, "--dim"), "--dim2": MIX("--dim", 60, "--bg") }, line: { "--line2": MIX("--line", 85, "--fg") } };
export const builtIn = (id, base) => { const c = ALL_COLORS.find(x => x.id === id); return c ? c[base] : ""; };

// ---- cleaning ----
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = v => typeof v === "string" && HEX.test(v.trim());
const long = h => { const x = h.trim().toLowerCase(); return x.length === 4 ? "#" + [...x.slice(1)].map(c => c + c).join("") : x; };
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
const oneOf = (v, list) => (list.includes(v) ? v : undefined);
const keep = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const nonEmpty = o => Object.keys(o).length > 0;

// Whatever was saved or imported, turned into a clean sparse look. Unknown keys and bad values are dropped.
export function normLook(raw) {
  const r = raw && typeof raw === "object" ? raw : {}, out = {};
  const text = {};
  for (const id of LEVEL_IDS) {
    const t = r.text?.[id] || {};
    const one = keep({ font: oneOf(t.font, FONT_IDS), size: num(t.size, SIZE_MIN, SIZE_MAX), weight: oneOf(t.weight, WEIGHTS.map(w => w[0])) });
    if (nonEmpty(one)) text[id] = one;
  }
  const colors = Object.fromEntries(COLOR_IDS.filter(id => isHex(r.colors?.[id])).map(id => [id, long(r.colors[id])]));
  const g = r.graph || {}, graph = keep({ style: oneOf(g.style, GRAPH_STYLES.map(s => s[0])), width: num(g.width, LINE_MIN, LINE_MAX), grid: typeof g.grid === "boolean" ? g.grid : undefined, smooth: typeof g.smooth === "boolean" ? g.smooth : undefined, limits: typeof g.limits === "boolean" ? g.limits : undefined });
  const s = r.size || {}, size = keep({ card: oneOf(s.card, CARD_SIZES.map(x => x[0])), density: oneOf(s.density, DENSITIES.map(x => x[0])), scale: num(s.scale, SCALE_MIN, SCALE_MAX) });
  for (const [k, v] of [["text", text], ["colors", colors], ["graph", graph], ["size", size]]) if (nonEmpty(v)) out[k] = v;
  return out;
}
// `over` on top of `base`, section by section (a text level is merged field by field).
export function mergeLook(base, over) {
  const a = normLook(base), b = normLook(over), text = { ...a.text };
  for (const id of Object.keys(b.text || {})) text[id] = { ...text[id], ...b.text[id] };
  return normLook({ text, colors: { ...a.colors, ...b.colors }, graph: { ...a.graph, ...b.graph }, size: { ...a.size, ...b.size } });
}
// A copy of `look` with the value at `path` set; undefined removes it and tidies empty parents away.
export function setPath(look, path, value) {
  const [head, ...rest] = path, cur = look && typeof look === "object" ? look : {}, next = { ...cur };
  const child = rest.length ? setPath(cur[head], rest, value) : value;
  if (child === undefined || (typeof child === "object" && !nonEmpty(child))) delete next[head]; else next[head] = child;
  return next;
}
export const getPath = (look, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), look);
export const graphOf = look => ({ ...DEFAULT_GRAPH, ...look?.graph });
export const sizeOf = look => ({ ...DEFAULT_SIZE, ...look?.size });

// ---- CSS ----
// The custom properties and <html> attributes a look sets. `large` is the older Large text switch (it multiplies with the text scale).
export function lookToCss(look, { large = false } = {}) {
  const vars = {}, c = look.colors || {};
  for (const item of ALL_COLORS) if (c[item.id]) for (const v of item.vars) vars[v] = c[item.id];
  for (const id of Object.keys(c)) Object.assign(vars, DERIVED[id]);
  if (c.acc) vars["--on-acc"] = contrast(c.acc, "#000000") >= contrast(c.acc, "#ffffff") ? "#000000" : "#ffffff";
  for (const [id, t] of Object.entries(look.text || {})) {
    if (t.font && fontStack(t.font)) vars["--font-" + id] = fontStack(t.font);
    if (t.size) vars["--size-" + id] = `calc(${t.size}px * var(--scale))`;
    if (t.weight) vars["--weight-" + id] = String(t.weight);
  }
  const g = graphOf(look), s = sizeOf(look), scale = Math.round((large ? LARGE_SCALE : 1) * s.scale * 1000) / 1000;
  Object.assign(vars, { "--line-w": String(g.width), "--area-op": String(AREA_OP[g.style]), "--graph-k": String(GRAPH_K[s.card]), "--dens": String(DENS_K[s.density]) });
  if (scale !== (large ? LARGE_SCALE : 1)) vars["--scale"] = String(scale);
  return { vars, attrs: { "data-grid": g.grid ? "on" : "off", "data-limits": g.limits ? "on" : "off" } };
}

// ---- contrast ----
const channel = v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const luminance = h => { const x = long(h); return 0.2126 * channel(parseInt(x.slice(1, 3), 16)) + 0.7152 * channel(parseInt(x.slice(3, 5), 16)) + 0.0722 * channel(parseInt(x.slice(5, 7), 16)); };
// WCAG contrast ratio of two hex colours, 1 to 21.
export function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
export const MIN_CONTRAST = 4.5;
// A friendly warning when the text and background colours are hard to read together, or "".
export function contrastWarning(look, base) {
  const fg = look.colors?.fg || builtIn("fg", base), bg = look.colors?.bg || builtIn("bg", base), r = contrast(fg, bg);
  return r < MIN_CONTRAST ? `Text on this background is hard to read (contrast ${r.toFixed(1)}, aim for ${MIN_CONTRAST} or more).` : "";
}

// ---- theme files ----
export const BASES = ["dark", "light"];
const FORMAT = 1;
// A saved or imported theme, cleaned: { id, name, base, look }.
export const normTheme = raw => ({ id: typeof raw?.id === "string" ? raw.id : "", name: String(raw?.name ?? "").trim().slice(0, NAME_MAX) || "Untitled", base: oneOf(raw?.base, BASES) || "dark", look: normLook(raw?.look) });
export const exportTheme = t => JSON.stringify({ "xsm-theme": FORMAT, name: t.name, base: t.base, look: normLook(t.look) }, null, 2);
// Pasted theme text to { ok: true, theme } or { ok: false, error } (a friendly sentence).
export function parseTheme(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste a theme first." };
  if (text.length > FILE_MAX) return { ok: false, error: "That is too long to be a theme." };
  let raw; try { raw = JSON.parse(text); } catch { return { ok: false, error: "That is not a theme file (it is not valid JSON)." }; }
  if (!raw || raw["xsm-theme"] !== FORMAT) return { ok: false, error: "That is not a theme exported from this app." };
  if (!nonEmpty(normLook(raw.look))) return { ok: false, error: "That theme has nothing in it to apply." };
  return { ok: true, theme: normTheme(raw) };
}
// A new id from a name that no theme in `taken` uses yet.
export function newId(name, taken) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
  let id = "my-" + slug, n = 2; while (taken.includes(id)) id = `my-${slug}-${n++}`;
  return id;
}
