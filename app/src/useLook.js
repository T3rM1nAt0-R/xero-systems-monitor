import { useEffect } from "react";
import * as api from "./api.js";
import { usePersisted } from "./store.js";
// Theme (dark, light, or follow Windows) and text size. Both are remembered.
export default function useLook() {
  const [theme, setTheme] = usePersisted("theme", "dark"), [size, setSize] = usePersisted("size", "normal");
  useEffect(() => {
    const apply = () => { const light = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches); document.documentElement.dataset.theme = light ? "light" : "dark"; api.setTheme(light ? "light" : "dark"); };
    apply(); if (theme !== "system") return; const q = window.matchMedia("(prefers-color-scheme: light)"); q.addEventListener("change", apply); return () => q.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => { document.documentElement.dataset.size = size; }, [size]);
  return { theme, setTheme, size, setSize };
}
