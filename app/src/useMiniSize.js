import { useEffect } from "react";
import * as api from "./api.js";
import { usePersisted } from "./store.js";
// The mini window's size you chose by dragging its edges. It is remembered and put back the next time mini opens.
// Until you drag, the window is as tall as its content (App.jsx); once there is a remembered size, that size wins.
export const MINI_SAVE_MS = 400, MINI_SETTLE_MS = 1500;
// A window size worth remembering: two sensible numbers, or null.
export const cleanSize = s => (s && Number.isFinite(s.w) && Number.isFinite(s.h) && s.w >= 100 && s.h >= 50 ? { w: Math.round(s.w), h: Math.round(s.h) } : null);
// How many columns the mini content gets at this width (the same steps as styles/runners.css).
export const miniColumns = w => (w >= 720 ? 3 : w >= 480 ? 2 : 1);
let quietUntil = 0;
// Resizes the app itself caused (opening mini, fitting the height) are not the person dragging an edge: ignore them for `ms`.
export const quietFor = ms => { quietUntil = Date.now() + ms; };
export default function useMiniSize(mini) {
  const [raw, setRaw] = usePersisted("miniSize", null), size = cleanSize(raw);
  useEffect(() => { if (mini && size) api.setMiniSize(size.w, size.h); }, [mini]);   // eslint-disable-line react-hooks/exhaustive-deps -- put the remembered size back once, when mini opens
  useEffect(() => {
    if (!mini) return undefined;
    let t = 0;
    quietFor(MINI_SETTLE_MS);
    const f = () => { if (Date.now() < quietUntil) return; clearTimeout(t); t = setTimeout(() => setRaw(cleanSize({ w: window.innerWidth, h: window.innerHeight })), MINI_SAVE_MS); };
    window.addEventListener("resize", f);
    return () => { window.removeEventListener("resize", f); clearTimeout(t); };
  }, [mini, setRaw]);
  return [size, () => setRaw(null)];   // the size, and a way to forget it (back to fitting the content)
}
