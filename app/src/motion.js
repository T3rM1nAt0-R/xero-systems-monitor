// The one place that says how long the window's open/close motion takes (keep in step with --dur in styles/tokens.css).
export const MOTION_MS = 180;
// How long the bigger effects take (a number rolling, a graph sliding or drawing in, a card gliding).
export const SLOW_MS = 480;
// A soft ring pulse on the newest point of a graph.
export const PULSE_MS = 800;
// Does the person want less motion? (Guarded: tests and old webviews may have no matchMedia.)
export const prefersReduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// The Motion setting as written on <html> by Customize: "full" (default), "subtle" or "off". Reduced motion in the system wins and gives "off".
export function motionLevel(reduced = prefersReduced(), attr = typeof document !== "undefined" ? document.documentElement.dataset.motion : undefined) {
  return reduced || attr === "off" ? "off" : attr === "subtle" ? "subtle" : "full";
}
// Should the bigger, decorative effects (glow, roll, overshoot, glide) run?
export const motionFull = (level = motionLevel()) => level === "full";
// How long to wait for a fold or fade to finish: nothing when motion is off.
export const motionMs = (reduced = prefersReduced(), attr) => (motionLevel(reduced, attr) === "off" ? 0 : MOTION_MS);
// Play a short transform/opacity animation on an element (runs on the compositor). Does nothing when motion is off or the browser has no animations.
export function play(el, frames, ms = SLOW_MS, { full = false, easing = "cubic-bezier(.2,.7,.2,1)" } = {}) {
  if (!el?.animate || (typeof document !== "undefined" && document.hidden) || motionLevel() === "off" || (full && !motionFull())) return null;
  return el.animate(frames, { duration: ms, easing });
}
