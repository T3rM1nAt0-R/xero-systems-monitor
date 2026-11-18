// The startup moment: from the first numbers arriving until STARTUP_MS later, cards cascade in and big numbers count up from zero.
export const STARTUP_MS = 1600;
let until = 0;
export const startupBegin = (now = Date.now()) => { until = now + STARTUP_MS; };
export const isStartup = (now = Date.now()) => now < until;
// The text of a number a fraction `k` (0 to 1) of the way up from zero, keeping its decimals and unit: "4.1 GB" at 0.5 is "2.1 GB". Text that is not a number is returned as it is.
export function countText(text, k) {
  const m = /^(-?\d+(?:\.\d+)?)(.*)$/s.exec(text || "");
  if (!m) return text;
  const eased = 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
  return (+m[1] * eased).toFixed((m[1].split(".")[1] || "").length) + m[2];
}
