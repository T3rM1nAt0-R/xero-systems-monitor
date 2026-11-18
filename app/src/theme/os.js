import { useEffect, useState } from "react";
// "Match Windows": the system accent colour, read through the CSS system colour AccentColor (Windows WebView2 and recent browsers), and the picture helpers for a background image.
// Light or dark is not read here: the window's own "follow the system" theme setting (prefers-color-scheme) does that.
const PICTURE_MAX = 1600;   // longest side of a background picture, in pixels
export const rgbToHex = text => {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(String(text));
  return m ? "#" + [m[1], m[2], m[3]].map(v => Math.min(255, +v).toString(16).padStart(2, "0")).join("") : "";
};
// The size a picture of w by h is scaled to so that its longest side is at most `max`.
export function fitSize(w, h, max = PICTURE_MAX) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}
export function readAccent() {
  try {
    if (!CSS.supports("color", "AccentColor")) return "";
    const el = document.createElement("i"); el.style.color = "AccentColor"; document.body.appendChild(el);
    const c = getComputedStyle(el).color; el.remove(); return rgbToHex(c);
  } catch { return ""; }
}
// The accent colour while `on`, "" when it cannot be read.
export function useOsAccent(on) {
  const [accent, setAccent] = useState("");
  useEffect(() => { if (on) setAccent(readAccent()); }, [on]);
  return on ? accent : "";
}
// A picture file as a smaller JPEG data URL (at most `limit` characters), or "" when it cannot be read or stays too big.
export async function readPicture(file, limit) {
  try {
    const bmp = await createImageBitmap(file), [w, h] = fitSize(bmp.width, bmp.height), cv = document.createElement("canvas");
    cv.width = w; cv.height = h; cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
    for (const q of [0.8, 0.6, 0.4]) { const url = cv.toDataURL("image/jpeg", q); if (url.length <= limit) return url; }
  } catch { /* not a picture the browser can read */ }
  return "";
}
