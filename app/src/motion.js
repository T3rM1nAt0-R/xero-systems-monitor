// The one place that says how long the window's open/close motion takes (keep in step with --dur in styles/tokens.css).
export const MOTION_MS = 180;
// Does the person want less motion? (Guarded: tests and old webviews may have no matchMedia.)
export const prefersReduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// How long to wait for a fold or fade to finish: nothing when motion is reduced.
export const motionMs = (reduced = prefersReduced()) => (reduced ? 0 : MOTION_MS);
