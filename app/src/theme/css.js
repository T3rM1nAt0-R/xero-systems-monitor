import { ALL_COLORS, BASE_ITEMS, builtIn, baseOf, valueOf, graphOf, layoutOf, shapeOf, surfaceOf } from "./model.js";
import { deriveColors, isLight, onColor, contrast, MIN_CONTRAST } from "./colors.js";
import { fontStack } from "./fonts.js";
// Turns a look into what the window shows: the colours that changed, the custom properties and the <html> attributes. Pure; useCustom writes the result once.
const CB_STATUS = { dark: { good: "#56b4e9", warn: "#e69f00", bad: "#d55e00" }, light: { good: "#0072b2", warn: "#8a5a00", bad: "#a33b00" } };
const GRAPH_K = { small: 0.75, medium: 1, large: 1.4 }, DENS_K = { compact: 0.85, comfortable: 1, spacious: 1.2 }, AREA_OP = { line: 0.08, area: 0.3, bars: 0, step: 0.08 };
const BORDER_W = { none: 0, hair: 1, bold: 2 };
const RADIUS_TODAY = 35, RADIUS_PILL_K = 8, PERCENT = 100, SHADOW_TODAY = 40, BLOB_ALPHA = "2e", GRADIENT_OP = 0.3;
// How much to multiply every corner radius by for the radius slider (0 to 100): 0 is square, 35 is today's look, 100 is as round as it goes.
export const radiusK = pct => (pct <= RADIUS_TODAY ? pct / RADIUS_TODAY : 1 + ((pct - RADIUS_TODAY) / (PERCENT - RADIUS_TODAY)) * (RADIUS_PILL_K - 1));
// The same for the shadow depth slider: 0 is flat, 40 is today's look.
export const shadowK = pct => pct / SHADOW_TODAY;

// Only the colours that differ from the plain dark or light tokens: { id: "#hex" }. Background and text derive the card, borders and dim text; the accent
// stands alone; the colour-blind switch swaps the good, warning and bad colours; anything the person set one by one wins over all of that.
export function colorMap(look, plain) {
  const c = look.colors || {}, out = {}, base = baseOf(look, plain);
  const bases = Object.fromEntries(BASE_ITEMS.map(i => [i.id, c[i.id] || builtIn(i.id, base)]));
  if (c.bg || c.fg) Object.assign(out, deriveColors(bases));
  if (valueOf(look, "cb")) Object.assign(out, CB_STATUS[isLight(bases.bg) ? "light" : "dark"]);
  return { ...out, ...c };
}
// Every colour of a look, set or built in, for the thumbnails and the contrast check: { id: "#hex" }.
export const fullColors = (look, plain) => ({ ...Object.fromEntries(ALL_COLORS.map(i => [i.id, i[baseOf(look, plain)]])), ...colorMap(look, plain) });
// A friendly warning when text or dim text is hard to read on the background or cards, or "".
export function contrastWarning(look, base) {
  const c = fullColors(look, base), worst = Math.min(contrast(c.fg, c.bg), contrast(c.fg, c.card), contrast(c.dim, c.bg), contrast(c.dim, c.card));
  return worst < MIN_CONTRAST ? `Text on this background is hard to read (contrast ${worst.toFixed(1)}, aim for ${MIN_CONTRAST} or more).` : "";
}
const ATTRS = { "data-grid": l => (valueOf(l, "graph.grid") ? "on" : "off"), "data-limits": l => (valueOf(l, "graph.limits") ? "on" : "off"), "data-glass": l => valueOf(l, "surface.glass"), "data-motion": l => valueOf(l, "motion"),
  "data-cb": l => (valueOf(l, "cb") ? "on" : "off"), "data-family": l => valueOf(l, "shape.family"), "data-border": l => valueOf(l, "shape.border"), "data-scan": l => (valueOf(l, "shape.scan") ? "on" : "off"),
  "data-bg": l => valueOf(l, "surface.bg"), "data-gridden": l => valueOf(l, "graph.density"), "data-axes": l => (valueOf(l, "graph.axes") ? "on" : "off"), "data-gradient": l => (valueOf(l, "graph.gradient") ? "on" : "off"),
  "data-glow": l => (valueOf(l, "graph.glow") ? "on" : "off"), "data-dots": l => (valueOf(l, "graph.dots") ? "on" : "off"), "data-cols": l => String(valueOf(l, "layout.cols")), "data-tabs": l => valueOf(l, "layout.tabs"), "data-heading": l => valueOf(l, "layout.heading"), "data-grain": l => (valueOf(l, "surface.grain") > 0 ? "on" : "off") };
// The custom properties and <html> attributes a look sets. `base` is the plain tokens the look sits on (Dark or Light) when it sets no background of its own;
// data-theme (light or dark, which every light-or-dark style keys off) always follows the background that is really shown.
export function lookToCss(look, { base: plain = "dark" } = {}) {
  const vars = {}, map = colorMap(look, plain);
  for (const item of ALL_COLORS) if (map[item.id]) for (const v of item.vars) vars[v] = map[item.id];
  if (map.card) vars["--tip-bg"] = map.card;
  if (map.acc) { vars["--on-acc"] = onColor(map.acc); vars["--blob-a"] = map.acc + BLOB_ALPHA; }
  for (const [id, t] of Object.entries(look.text || {})) {
    if (t.font && fontStack(t.font)) vars["--font-" + id] = fontStack(t.font);
    if (t.size) vars["--size-" + id] = `calc(${t.size}px * var(--scale))`;
    if (t.weight) vars["--weight-" + id] = String(t.weight);
  }
  const g = graphOf(look), l = layoutOf(look), s = surfaceOf(look), sh = shapeOf(look), scale = valueOf(look, "scale");
  Object.assign(vars, { "--line-w": String(g.width), "--area-op": String(g.gradient && AREA_OP[g.style] ? GRADIENT_OP : AREA_OP[g.style]), "--graph-k": String(GRAPH_K[l.card]), "--dens": String(DENS_K[l.density]),
    "--rk": String(radiusK(sh.radius)), "--shadow-k": String(shadowK(sh.shadow)), "--bw": BORDER_W[sh.border] + "px", "--grain": String(s.grain / PERCENT) });
  if (s.tint) vars["--glass-tint"] = s.tint;
  if (s.bg === "image" && s.image) vars["--bg-image"] = `url(${s.image})`;
  if (scale !== 1) vars["--scale"] = String(scale);
  return { vars, attrs: { "data-theme": baseOf(look, plain), ...Object.fromEntries(Object.entries(ATTRS).map(([k, f]) => [k, f(look)])) } };
}
