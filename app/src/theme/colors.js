// Pure colour maths: hex parsing, mixing, WCAG contrast, and how three base colours (background, text, accent) give every other colour of the window.
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = v => typeof v === "string" && HEX.test(v.trim());
export const longHex = h => { const x = h.trim().toLowerCase(); return x.length === 4 ? "#" + [...x.slice(1)].map(c => c + c).join("") : x; };
const rgb = h => { const x = longHex(h); return [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); };
const toHex = parts => "#" + parts.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
// `a` moved `t` (0 to 1) of the way toward `b`.
export const mix = (a, b, t) => { const y = rgb(b); return toHex(rgb(a).map((v, i) => v + (y[i] - v) * t)); };
const channel = v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
export const luminance = h => { const [r, g, b] = rgb(h); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
// WCAG contrast ratio of two hex colours, 1 to 21.
export function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
export const MIN_CONTRAST = 4.5, MIN_FAINT = 3, LIGHT_LUMA = 0.4, NUDGE = 0.05;
export const isLight = bg => luminance(bg) > LIGHT_LUMA;
// `c` nudged toward `toward` until it reads on every colour of `on` (or it has become `toward`).
export function readable(c, toward, on, min = MIN_CONTRAST) {
  let x = c, t = 0;
  while (t < 1 && on.some(o => contrast(x, o) < min)) { t += NUDGE; x = mix(c, toward, t); }
  return x;
}
const BLACK = "#000000", WHITE = "#ffffff";
export const onColor = c => (contrast(c, BLACK) >= contrast(c, WHITE) ? BLACK : WHITE);
// How far each derived colour sits between the background and the text colour.
const STEP = { dark: { s2: 0.08, line: 0.12, line2: 0.2 }, light: { s2: 0.04, line: 0.1, line2: 0.2 } };
const CARD_DARK = 0.04, CARD_LIGHT = 0.7, DIM = 0.35, MID = 0.2, FAINT = 0.65;
// Every colour that follows from the background and text colours: { card, s2, line, line2, dim, mid, dim2 }. Dim and mid text always read on the background and cards; the faintest text keeps at least MIN_FAINT.
export function deriveColors({ bg, fg }) {
  const light = isLight(bg), k = STEP[light ? "light" : "dark"];
  const card = light ? mix(bg, WHITE, CARD_LIGHT) : mix(bg, fg, CARD_DARK), s2 = mix(bg, fg, k.s2), on = [bg, card, s2];
  return { card, s2, line: mix(bg, fg, k.line), line2: mix(bg, fg, k.line2), dim: readable(mix(fg, bg, DIM), fg, on), mid: readable(mix(fg, bg, MID), fg, on), dim2: readable(mix(fg, bg, FAINT), fg, on, MIN_FAINT) };
}
