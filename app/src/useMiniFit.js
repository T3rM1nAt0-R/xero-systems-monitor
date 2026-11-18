import { useEffect, useRef } from "react";
import * as api from "./api.js";
import { quietFor, MINI_SETTLE_MS, userResizingNow } from "./useMiniSize.js";
import { FIT_DEBOUNCE_MS, FIT_POLL_MS, shouldResize, wantedHeight, contentHeight } from "./miniFit.js";
// In mini mode, with no size you dragged, the window is as tall as its content. A change is noticed (a new reading, a layout change), waited out for a moment,
// and sent only when the height really moved (miniFit.js). Nothing is sent while you are dragging an edge.
export default function useMiniFit(mini, appRef, fixed) {
  const sent = useRef(null);   // the last height sent
  useEffect(() => {
    if (!mini || fixed) return undefined;
    let t = 0; sent.current = null;
    const run = () => {
      const el = appRef.current;
      if (!el) return;
      if (userResizingNow()) { t = setTimeout(run, FIT_DEBOUNCE_MS); return; }
      const want = wantedHeight(contentHeight([...el.children]));
      if (!shouldResize(sent.current, want)) return;
      sent.current = want; quietFor(MINI_SETTLE_MS); api.setMiniHeight(want);
    };
    const later = () => { clearTimeout(t); t = setTimeout(run, FIT_DEBOUNCE_MS); };
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
    for (const c of appRef.current?.children || []) ro?.observe(c);
    later();
    const id = setInterval(later, FIT_POLL_MS);   // rows that appear later are not watched by the observer; a calm look now and then catches them
    return () => { clearTimeout(t); clearInterval(id); ro?.disconnect(); };
  }, [mini, fixed, appRef]);
}
