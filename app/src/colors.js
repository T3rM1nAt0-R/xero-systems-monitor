import { useSyncExternalStore } from "react";
// Metric colours live in CSS (--c-cpu, --c-temp, ... in styles/tokens.css). Drawing code that can use CSS passes `metricVar(k)`;
// code that needs a real colour value (shades for compared machines, canvas) reads it here. The values are read from the page once,
// and again only when the theme, text size or inline style of <html> changes, never per frame.
export const METRICS = ["cpu", "temp", "ram", "gpu", "gtemp", "vram", "down", "up", "ping", "disk"];
export const metricVar = k => `var(--c-${k})`;

// Any CSS colour as "#rrggbb" (or "rgba(...)" when it is see-through), through a canvas.
function toHex(c) {
  try { const g = document.createElement("canvas").getContext("2d"); g.fillStyle = "#000"; g.fillStyle = c; return g.fillStyle; } catch { return c; }
}
// The metric colours as seen from `el` (a card can carry its own --c-* values). Default: the page.
export function readColors(el = document.documentElement) {
  const cs = getComputedStyle(el);
  return Object.fromEntries(METRICS.map(k => [k, toHex(cs.getPropertyValue("--c-" + k).trim())]));
}
let cache = null, watching = false;
const subs = new Set();
const bump = () => { cache = null; subs.forEach(f => f()); };
export const metricColors = () => (cache ||= readColors());
export function subscribe(f) {
  if (!watching && typeof MutationObserver !== "undefined") {
    watching = true;
    new MutationObserver(bump).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-size", "style", "class"] });
  }
  subs.add(f);
  return () => subs.delete(f);
}
// The resolved colours, kept up to date when the theme changes.
export const useMetricColors = () => useSyncExternalStore(subscribe, metricColors);
