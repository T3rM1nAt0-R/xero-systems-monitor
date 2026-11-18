import { useEffect, useState } from "react";
import * as api from "./api.js";
import { usePersisted } from "./store.js";
import useCustom from "./theme/useCustom.js";
// Theme (dark, light, or follow Windows), text size, and the Customize look on top of them (themes, fonts, colours, graphs, sizes). All are remembered.
export default function useLook() {
  const [theme, setTheme] = usePersisted("theme", "dark"), [size, setSize] = usePersisted("size", "normal"), [base, setBase] = useState(() => document.documentElement.dataset.theme || "dark");
  useEffect(() => {
    const apply = () => { const light = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches); document.documentElement.dataset.theme = light ? "light" : "dark"; setBase(light ? "light" : "dark"); api.setTheme(light ? "light" : "dark"); };
    apply(); if (theme !== "system") return; const q = window.matchMedia("(prefers-color-scheme: light)"); q.addEventListener("change", apply); return () => q.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => { document.documentElement.dataset.size = size; }, [size]);
  const custom = useCustom({ base, setTheme, large: size === "large" });
  // The menu's Dark / Light / Windows buttons choose the plain theme again (the saved edits stay in Customize until reset).
  const pickTheme = k => { setTheme(k); custom.pick(k === "system" ? "" : k); };
  return { theme, setTheme: pickTheme, size, setSize, custom };
}
