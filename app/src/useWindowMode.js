import { useCallback, useEffect, useState } from "react";
import * as api from "./api.js";
import { usePersisted } from "./store.js";
// How the window is shown: always on top, compact rows, the small corner (mini) window, and the settings the app shell keeps.
export default function useWindowMode() {
  const [pin, setPin] = usePersisted("pin", true), [compact, setCompact] = usePersisted("compact", () => { try { return JSON.parse(localStorage.getItem("xm.strip")) || false; } catch { return false; } });
  const [mini, setMini] = useState(false), [prefs, setPrefs] = useState(null), [width, setWidth] = useState(window.innerWidth);
  useEffect(() => { api.setPinned(pin); }, [pin]);
  useEffect(() => { api.windowMode(mini ? "mini" : compact ? "compact" : "full"); }, [mini, compact]);   // tells the shell which size and place the window should have
  useEffect(() => { api.getPrefs().then(setPrefs); const a = api.onShellEvent("window-mode", m => setMini(m === "mini")), b = api.onShellEvent("pinned", setPin); return () => { a(); b(); }; }, []);   // "mini" and "pin" also come from the tray menu
  useEffect(() => { const f = () => setWidth(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const toggleMini = useCallback(() => setMini(x => !x), []);
  return { pin, setPin, compact, setCompact, mini, toggleMini, prefs, setPrefs, width, effCompact: compact || mini || width < 300 };
}
