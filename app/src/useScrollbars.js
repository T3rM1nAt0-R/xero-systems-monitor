import { useEffect } from "react";
// Overlay-style scrollbars (styles/scrollbars.css): a bar is nearly invisible until something scrolls. This marks the scrolling element with data-scrolling for a moment.
// One cheap passive listener for the whole page (scroll does not bubble, so it listens while the event travels down).
export const SCROLL_SHOW_MS = 900;
export default function useScrollbars() {
  useEffect(() => {
    const timers = new WeakMap();
    const on = e => {
      const el = e.target === document ? document.documentElement : e.target;
      if (!el?.setAttribute) return;
      el.setAttribute("data-scrolling", "");
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => el.removeAttribute("data-scrolling"), SCROLL_SHOW_MS));
    };
    document.addEventListener("scroll", on, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", on, { capture: true });
  }, []);
}
