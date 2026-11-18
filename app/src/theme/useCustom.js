import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePersisted, get, set } from "../store.js";
import { getPath, setPath } from "./model.js";
import { lookToCss } from "./css.js";
import { normTheme, exportTheme, parseTheme, newId } from "./files.js";
import { allThemes, cleanSaved, resolveTheme, makeTheme, isCustom, migrateStored } from "./presets.js";
import { startHistory, record, undo, redo, canUndo, canRedo } from "./history.js";
// The custom look as the window uses it: saved themes ("themes"), the chosen one ("themeId") and the edits not saved yet ("edits"), all in the settings store.
// The result is written once to <html> as custom properties and data attributes, so nothing re-renders; charts read colours through colors.js, which watches <html>.
// Undo and redo keep the steps of this session only (they are not saved).
let applied = [];
function apply({ vars, attrs }) {
  const el = document.documentElement;
  for (const k of applied) if (!(k in vars) && !(k in attrs)) el.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  applied = [...Object.keys(vars), ...Object.keys(attrs)];
}
// Themes and edits saved by an older version are brought forward once, before anything reads them (presets.js, migrate.js).
let migrated = false;
function migrateOnce() {
  if (migrated) return;
  migrated = true;
  const m = migrateStored({ themes: get("themes", []), themeId: get("themeId", ""), edits: get("edits", {}) });
  if (m.changed) { set("themes", m.themes); set("themeId", m.themeId); set("edits", m.edits); }
}

export default function useCustom({ base, setTheme, large }) {
  migrateOnce();
  const [saved, setSaved] = usePersisted("themes", []), [id, setId] = usePersisted("themeId", ""), [edits, setEdits] = usePersisted("edits", {});
  const themes = useMemo(() => cleanSaved(saved), [saved]);
  const hist = useRef(null), [, bump] = useReducer(n => n + 1, 0), [comparing, setComparing] = useState(false), opened = useRef(null);
  if (!hist.current) hist.current = startHistory({ id, edits });
  const { theme, look: own } = useMemo(() => resolveTheme(themes, id, edits), [themes, id, edits]);
  const was = useMemo(() => (opened.current ? resolveTheme(themes, opened.current.id, opened.current.edits) : null), [themes, comparing]);   // eslint-disable-line react-hooks/exhaustive-deps -- the look from when the panel opened
  const shown = comparing && was ? was : { theme, look: own };
  const shownBase = shown.theme?.base || base;
  const css = useMemo(() => lookToCss(shown.look, { large, base: shownBase }), [shown.look, large, shownBase]);
  useEffect(() => apply(css), [css]);
  useEffect(() => { if (comparing && was?.theme) setTheme(was.theme.base); else if (!comparing && theme) setTheme(theme.base); }, [comparing]);   // eslint-disable-line react-hooks/exhaustive-deps -- only when the eye is pressed or let go

  const commit = useCallback((nextId, nextEdits, key) => { hist.current = record(hist.current, { id: nextId, edits: nextEdits }, key); setId(nextId); setEdits(nextEdits); bump(); }, [setId, setEdits]);
  const jump = useCallback(h => { hist.current = h; const t = allThemes(themes).find(x => x.id === h.present.id); if (t) setTheme(t.base); setId(h.present.id); setEdits(h.present.edits); bump(); }, [themes, setTheme, setId, setEdits]);
  const pick = useCallback(next => { const t = allThemes(themes).find(x => x.id === next); if (t) setTheme(t.base); commit(t ? next : "", {}); }, [themes, setTheme, commit]);
  const edit = useCallback((path, value) => commit(id, setPath(edits, path, value), path.join(".")), [commit, id, edits]);
  const addTheme = useCallback(t => { setSaved([...themes, t]); setTheme(t.base); commit(t.id, {}); }, [themes, setSaved, setTheme, commit]);
  const saveAs = useCallback(name => addTheme(makeTheme(themes, name, shownBase, own)), [addTheme, themes, shownBase, own]);
  const save = useCallback(() => { if (theme && !theme.builtIn) { setSaved(themes.map(t => (t.id === id ? { ...t, look: own } : t))); commit(id, {}); } }, [theme, themes, id, own, setSaved, commit]);
  const rename = useCallback((tid, name) => setSaved(themes.map(t => (t.id === tid ? normTheme({ ...t, name }) : t))), [themes, setSaved]);
  const remove = useCallback(tid => { setSaved(themes.filter(t => t.id !== tid)); if (id === tid) commit("", {}); }, [themes, id, setSaved, commit]);
  const importText = useCallback(text => {
    const r = parseTheme(text); if (!r.ok) return r;
    addTheme({ ...r.theme, id: newId(r.theme.name, allThemes(themes).map(t => t.id)) }); return r;
  }, [addTheme, themes]);
  const exportText = useCallback(() => exportTheme({ name: theme?.name || "My look", base: shownBase, look: own }), [theme, shownBase, own]);
  // Called when the panel opens: what you see now is what the eye button shows again.
  const remember = useCallback(() => { opened.current = { id, edits }; }, [id, edits]);
  return { themes, id, theme, look: shown.look, own, base: shownBase, dirty: isCustom(theme, own), canSave: !!theme && !theme.builtIn, edits, pick, edit, reset: path => edit(path, undefined), resetAll: () => commit(id, {}), has: path => getPath(edits, path) !== undefined,
    save, saveAs, rename, remove, importText, exportText, remember, setComparing, comparing,
    undo: () => jump(undo(hist.current)), redo: () => jump(redo(hist.current)), canUndo: canUndo(hist.current), canRedo: canRedo(hist.current) };
}
