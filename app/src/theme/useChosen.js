import { useMemo } from "react";
import { usePersisted, get, set, forget } from "../store.js";
import { useSystemLight } from "./os.js";
import { cleanAppearance, cleanSlots, activeId, foldShared } from "./appearance.js";
import { allThemes, cleanSaved, cleanEditsBy, cleanShared, resolveTheme, migratePrefs } from "./presets.js";
// What is chosen, from the settings store: saved themes ("themes"), One theme or Follow Windows ("appearance"), the one theme ("themeId"), the Light and Dark slots ("slots") and each tile's colour edits ("editsBy") and the shared other edits ("shared").
// The tile showing follows the system live while Follow Windows is on (nothing is saved for that). Shared by Customize and the charts.
const NONE = {}, NO_THEMES = [];
// Whatever an older version saved is brought into tiles once, before anything reads it: while no "appearance" is saved yet (presets.js, legacy.js).
let migrated = false;
function migrateOnce() {
  if (migrated) return;
  migrated = true;
  if (get("appearance", undefined) !== undefined) { foldOnce(); return; }
  const m = migratePrefs({ themes: get("themes", []), themeId: get("themeId", ""), edits: get("edits", {}), theme: get("theme", undefined), size: get("size", undefined), mode: get("mode", undefined), sysLight: !!window.matchMedia?.("(prefers-color-scheme: light)").matches });
  for (const k of ["themes", "themeId", "slots", "editsBy", "shared", "appearance"]) set(k, m[k]);
  for (const k of ["edits", "mode", "theme", "size"]) forget(k);
}
// 0.4.2-style state kept every edit per tile: the non-colour ones fold into one shared set (the tile showing wins), the colours stay per tile.
function foldOnce() {
  if (get("shared", undefined) !== undefined) return;
  const by = get("editsBy", {}), slots = get("slots", {}), shown = get("appearance", "one") === "system" ? slots[window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark"] : get("themeId", "dark");
  set("shared", foldShared(by, shown));
  set("editsBy", Object.fromEntries(Object.entries(by).filter(([, e]) => e?.colors).map(([k, e]) => [k, { colors: e.colors }])));
}
export default function useChosen() {
  migrateOnce();
  const [saved, setSaved] = usePersisted("themes", NO_THEMES), [appRaw, setAppearance] = usePersisted("appearance", "one"), [themeId, setThemeId] = usePersisted("themeId", "dark"), [slotsRaw, setSlots] = usePersisted("slots", NONE), [byRaw, setEditsBy] = usePersisted("editsBy", NONE), [sharedRaw, setShared] = usePersisted("shared", NONE);
  const themes = useMemo(() => cleanSaved(saved), [saved]), all = useMemo(() => allThemes(themes), [themes]), appearance = cleanAppearance(appRaw);
  const slots = useMemo(() => cleanSlots(slotsRaw, all), [slotsRaw, all]), editsBy = useMemo(() => cleanEditsBy(byRaw, all), [byRaw, all]);
  const sysLight = useSystemLight(appearance === "system"), id = activeId({ appearance, themeId, slots }, sysLight, all);
  const shared = useMemo(() => cleanShared(sharedRaw), [sharedRaw]), { theme, look } = useMemo(() => resolveTheme(themes, id, editsBy, shared), [themes, id, editsBy, shared]);
  return { saved, themes, all, appearance, themeId, slots, editsBy, shared, sysLight, id, theme, look, setSaved, setAppearance, setThemeId, setSlots, setEditsBy, setShared };
}
