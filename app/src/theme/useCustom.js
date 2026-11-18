import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePersisted, get, set, forget } from "../store.js";
import { getPath, setPath, mergeLook } from "./model.js";
import { useOsAccent, useSystemLight } from "./os.js";
import { pruneAll } from "./edits.js";
import { sideOf, cleanMode } from "./modes.js";
import * as api from "../api.js";
import { lookToCss } from "./css.js";
import { normTheme, exportTheme, parseTheme, newId } from "./files.js";
import { allThemes, cleanSaved, resolveTheme, makeTheme, isCustom, migratePrefs, bake } from "./presets.js";
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
  const m = migratePrefs({ themes: get("themes", []), themeId: get("themeId", ""), edits: get("edits", {}), theme, size, mode: get("mode", undefined), sysLight: !!window.matchMedia?.("(prefers-color-scheme: light)").matches });
  if (m.changed) { set("themes", m.themes); set("themeId", m.themeId); set("edits", m.edits); set("mode", m.mode); }
  if (theme !== undefined) forget("theme");
  if (size !== undefined) forget("size");
}

export default function useCustom() {
  migrateOnce();
  const [saved, setSaved] = usePersisted("themes", []), [id, setId] = usePersisted("themeId", ""), [edits, setEdits] = usePersisted("edits", {}), [modeRaw, setMode] = usePersisted("mode", "dark"), [editMode, setEditMode] = useState(null), mode = cleanMode(modeRaw);
  const themes = useMemo(() => cleanSaved(saved), [saved]);
  const hist = useRef(null), [, bump] = useReducer(n => n + 1, 0), [comparing, setComparing] = useState(false), opened = useRef(null);
  if (!hist.current) hist.current = startHistory({ id, edits });
  const sysLight = useSystemLight(mode === "system"), side = sideOf(mode, sysLight);   // Dark, Light, or Windows (follows the system live)
  const { theme, look: own } = useMemo(() => resolveTheme(themes, id, edits, side), [themes, id, edits, side]);
  const was = useMemo(() => (opened.current ? resolveTheme(themes, opened.current.id, opened.current.edits, side) : null), [themes, comparing, side]);   // eslint-disable-line react-hooks/exhaustive-deps -- the look from when the panel opened
  const shown = comparing && was ? was : { theme, look: own };   // holding the eye only shows the old look; nothing is saved
  const osOn = !!getPath(shown.look, ["surface", "os"]), accent = useOsAccent(osOn);   // "Use Windows accent colour"
  const plain = side;
  const lookNow = useMemo(() => (osOn && accent ? mergeLook(shown.look, { colors: { acc: accent } }) : shown.look), [shown.look, osOn, accent]);
  const css = useMemo(() => lookToCss(lookNow, { base: plain }), [lookNow, plain]);
  const base = css.attrs["data-theme"];   // light or dark: always worked out from the background that is shown, never saved
  useEffect(() => apply(css), [css]);
  useEffect(() => { api.setTheme(base); }, [base]);

  const commit = useCallback((nextId, nextEdits, key) => {
    const t = allThemes(themes).find(x => x.id === nextId), clean = pruneAll(t, nextEdits);   // an edit stays only while it differs from the theme
    hist.current = record(hist.current, { id: nextId, edits: clean }, key); setId(nextId); setEdits(clean); bump();
  }, [themes, setId, setEdits]);
  const jump = useCallback(h => { hist.current = h; setId(h.present.id); setEdits(h.present.edits); bump(); }, [setId, setEdits]);
  const editing = editMode || side, mp = useCallback(p => (p[0] === "colors" && p.length === 2 ? ["colors", editing, p[1]] : p), [editing]);   // a colour edit goes to the version being edited
  const editLook = useMemo(() => resolveTheme(themes, id, edits, editing).look, [themes, id, edits, editing]);
  const chooseMode = useCallback(m => { setMode(cleanMode(m)); setEditMode(null); }, [setMode]);
  const pick = useCallback(next => commit(allThemes(themes).some(x => x.id === next) ? next : "", {}), [themes, commit]);
  const editMany = useCallback((pairs, key) => commit(id, pairs.reduce((e, [p, v]) => setPath(e, mp(p.split(".")), v), edits), key), [commit, id, edits, mp]);
  const edit = useCallback((path, value) => commit(id, setPath(edits, mp(path), value), mp(path).join(".")), [commit, id, edits, mp]);
  const addTheme = useCallback(t => { setSaved([...themes, t]); commit(t.id, {}); }, [themes, setSaved, commit]);
  const saveAs = useCallback(name => addTheme(makeTheme(themes, name, bake(theme, edits))), [addTheme, themes, theme, edits]);
  const save = useCallback(() => { if (theme && !theme.builtIn) { setSaved(themes.map(t => (t.id === id ? { ...t, ...bake(t, edits) } : t))); commit(id, {}); } }, [theme, themes, id, edits, setSaved, commit]);
  const rename = useCallback((tid, name) => setSaved(themes.map(t => (t.id === tid ? normTheme({ ...t, name }) : t))), [themes, setSaved]);
  const remove = useCallback(tid => { setSaved(themes.filter(t => t.id !== tid)); if (id === tid) commit("", {}); }, [themes, id, setSaved, commit]);
  const importText = useCallback(text => {
    const r = parseTheme(text); if (!r.ok) return r;
    addTheme({ ...r.theme, id: newId(r.theme.name, allThemes(themes).map(t => t.id)) }); return r;
  }, [addTheme, themes]);
  const exportText = useCallback(() => exportTheme({ name: theme?.name || "My look", ...bake(theme, edits) }), [theme, edits]);
  // Called when the panel opens: what you see now is what the eye button shows again.
  const remember = useCallback(() => { opened.current = { id, edits }; }, [id, edits]);
  return { themes, id, theme, look: shown.look, own, base, dirty: isCustom(edits), mode, setMode: chooseMode, side, editing, setEditing: setEditMode, editLook, canSave: !!theme && !theme.builtIn, edits, pick, edit, editMany, reset: path => edit(path, undefined), resetAll: () => commit(id, {}), has: path => getPath(edits, mp(path)) !== undefined,
    save, saveAs, rename, remove, importText, exportText, remember, setComparing, comparing,
    undo: () => jump(undo(hist.current)), redo: () => jump(redo(hist.current)), canUndo: canUndo(hist.current), canRedo: canRedo(hist.current) };
}
