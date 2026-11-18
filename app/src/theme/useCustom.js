import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePersisted, get, set, forget } from "../store.js";
import { getPath, setPath, mergeLook, baseOf } from "./model.js";
import { useOsAccent, useSystemLight } from "./os.js";
import { pruneEdits } from "./edits.js";
import * as api from "../api.js";
import { lookToCss } from "./css.js";
import { normTheme, exportTheme, parseTheme, newId } from "./files.js";
import { allThemes, cleanSaved, resolveTheme, makeTheme, isCustom, migratePrefs } from "./presets.js";
import { startHistory, record, undo, redo, canUndo, canRedo } from "./history.js";
// The custom look as the window uses it: saved themes ("themes"), the chosen one ("themeId") and the edits not saved yet ("edits"), all in the settings store.
// The result is written once to <html> as custom properties and data attributes, so nothing re-renders; charts read colours through colors.js, which watches <html>.
// Undo and redo keep the steps of this session (they live here, not in the panel, so closing the panel keeps them; they are not saved between runs).
let applied = [];
function apply({ vars, attrs }) {
  const el = document.documentElement;
  for (const k of applied) if (!(k in vars) && !(k in attrs)) el.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  applied = [...Object.keys(vars), ...Object.keys(attrs)];
}
// Themes and edits saved by an older version, and the old separate theme and text size settings, are brought forward once, before anything reads them (presets.js).
let migrated = false;
function migrateOnce() {
  if (migrated) return;
  migrated = true;
  const theme = get("theme", undefined), size = get("size", undefined);
  const m = migratePrefs({ themes: get("themes", []), themeId: get("themeId", ""), edits: get("edits", {}), theme, size });
  if (m.changed) { set("themes", m.themes); set("themeId", m.themeId); set("edits", m.edits); }
  if (theme !== undefined) forget("theme");
  if (size !== undefined) forget("size");
}

export default function useCustom() {
  migrateOnce();
  const [saved, setSaved] = usePersisted("themes", []), [id, setId] = usePersisted("themeId", ""), [edits, setEdits] = usePersisted("edits", {});
  const themes = useMemo(() => cleanSaved(saved), [saved]);
  const hist = useRef(null), [, bump] = useReducer(n => n + 1, 0), [comparing, setComparing] = useState(false), opened = useRef(null);
  if (!hist.current) hist.current = startHistory({ id, edits });
  const { theme, look: own } = useMemo(() => resolveTheme(themes, id, edits), [themes, id, edits]);
  const was = useMemo(() => (opened.current ? resolveTheme(themes, opened.current.id, opened.current.edits) : null), [themes, comparing]);   // eslint-disable-line react-hooks/exhaustive-deps -- the look from when the panel opened
  const shown = comparing && was ? was : { theme, look: own };   // holding the eye only shows the old look; nothing is saved
  const osOn = !!getPath(shown.look, ["surface", "os"]), accent = useOsAccent(osOn), sysLight = useSystemLight(osOn);   // "Match Windows": follow the system light/dark and accent
  const plain = osOn ? (sysLight ? "light" : "dark") : shown.theme?.base || "dark";
  const lookNow = useMemo(() => (osOn && accent ? mergeLook(shown.look, { colors: { acc: accent } }) : shown.look), [shown.look, osOn, accent]);
  const css = useMemo(() => lookToCss(lookNow, { base: plain }), [lookNow, plain]);
  const base = css.attrs["data-theme"];   // light or dark: always worked out from the background that is shown, never saved
  useEffect(() => apply(css), [css]);
  useEffect(() => { api.setTheme(base); }, [base]);

  const commit = useCallback((nextId, nextEdits, key) => {
    const t = allThemes(themes).find(x => x.id === nextId), clean = pruneEdits(t?.look, nextEdits);   // an edit stays only while it differs from the theme
    hist.current = record(hist.current, { id: nextId, edits: clean }, key); setId(nextId); setEdits(clean); bump();
  }, [themes, setId, setEdits]);
  const jump = useCallback(h => { hist.current = h; setId(h.present.id); setEdits(h.present.edits); bump(); }, [setId, setEdits]);
  const pick = useCallback(next => commit(allThemes(themes).some(x => x.id === next) ? next : "", {}), [themes, commit]);
  const editMany = useCallback((pairs, key) => commit(id, pairs.reduce((e, [p, v]) => setPath(e, p.split("."), v), edits), key), [commit, id, edits]);
  const edit = useCallback((path, value) => commit(id, setPath(edits, path, value), path.join(".")), [commit, id, edits]);
  const addTheme = useCallback(t => { setSaved([...themes, t]); commit(t.id, {}); }, [themes, setSaved, commit]);
  const saveAs = useCallback(name => addTheme(makeTheme(themes, name, base, own)), [addTheme, themes, base, own]);
  const save = useCallback(() => { if (theme && !theme.builtIn) { setSaved(themes.map(t => (t.id === id ? { ...t, look: own, base: baseOf(own, t.base) } : t))); commit(id, {}); } }, [theme, themes, id, own, setSaved, commit]);
  const rename = useCallback((tid, name) => setSaved(themes.map(t => (t.id === tid ? normTheme({ ...t, name }) : t))), [themes, setSaved]);
  const remove = useCallback(tid => { setSaved(themes.filter(t => t.id !== tid)); if (id === tid) commit("", {}); }, [themes, id, setSaved, commit]);
  const importText = useCallback(text => {
    const r = parseTheme(text); if (!r.ok) return r;
    addTheme({ ...r.theme, id: newId(r.theme.name, allThemes(themes).map(t => t.id)) }); return r;
  }, [addTheme, themes]);
  const exportText = useCallback(() => exportTheme({ name: theme?.name || "My look", base, look: own }), [theme, base, own]);
  // Called when the panel opens: what you see now is what the eye button shows again.
  const remember = useCallback(() => { opened.current = { id, edits }; }, [id, edits]);
  return { themes, id, theme, look: shown.look, own, base, dirty: isCustom(theme, own), canSave: !!theme && !theme.builtIn, edits, pick, edit, editMany, reset: path => edit(path, undefined), resetAll: () => commit(id, {}), has: path => getPath(edits, path) !== undefined,
    save, saveAs, rename, remove, importText, exportText, remember, setComparing, comparing,
    undo: () => jump(undo(hist.current)), redo: () => jump(redo(hist.current)), canUndo: canUndo(hist.current), canRedo: canRedo(hist.current) };
}
