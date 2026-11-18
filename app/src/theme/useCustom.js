import { useCallback, useEffect, useMemo } from "react";
import { usePersisted } from "../store.js";
import { getPath, setPath, lookToCss, normTheme, exportTheme, parseTheme, normLook, newId } from "./model.js";
import { allThemes, cleanSaved, resolveTheme, makeTheme } from "./presets.js";
// The custom look as the window uses it: saved themes ("themes"), the chosen one ("themeId") and the edits not saved yet ("edits"), all in the settings store.
// The result is written once to <html> as custom properties and data attributes, so nothing re-renders; charts read colours through colors.js, which watches <html>.
let applied = [];
function apply({ vars, attrs }) {
  const el = document.documentElement;
  for (const k of applied) if (!(k in vars) && !(k in attrs)) el.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  applied = Object.keys(vars);
}

export default function useCustom({ base, setTheme, large }) {
  const [saved, setSaved] = usePersisted("themes", []), [id, setId] = usePersisted("themeId", ""), [edits, setEdits] = usePersisted("edits", {});
  const themes = useMemo(() => cleanSaved(saved), [saved]);
  const { theme, look } = useMemo(() => resolveTheme(themes, id, edits), [themes, id, edits]);
  const css = useMemo(() => lookToCss(look, { large }), [look, large]);
  useEffect(() => apply(css), [css]);

  const pick = useCallback(next => { const t = allThemes(themes).find(x => x.id === next); if (t) setTheme(t.base); setId(t ? next : ""); setEdits({}); }, [themes, setTheme, setId, setEdits]);
  const edit = useCallback((path, value) => setEdits(e => setPath(e, path, value)), [setEdits]);
  const addTheme = useCallback(t => { setSaved([...themes, t]); setTheme(t.base); setId(t.id); setEdits({}); }, [themes, setSaved, setTheme, setId, setEdits]);
  const saveAs = useCallback(name => addTheme(makeTheme(themes, name, base, look)), [addTheme, themes, base, look]);
  const rename = useCallback((tid, name) => setSaved(themes.map(t => (t.id === tid ? normTheme({ ...t, name }) : t))), [themes, setSaved]);
  const remove = useCallback(tid => { setSaved(themes.filter(t => t.id !== tid)); if (id === tid) pick(base); }, [themes, id, base, pick, setSaved]);
  const importText = useCallback(text => {
    const r = parseTheme(text); if (!r.ok) return r;
    addTheme({ ...r.theme, id: newId(r.theme.name, allThemes(themes).map(t => t.id)) }); return r;
  }, [addTheme, themes]);
  const exportText = useCallback(() => exportTheme({ name: theme?.name || "My look", base, look }), [theme, base, look]);
  return { themes, id, theme, look, base, dirty: Object.keys(normLook(edits)).length > 0, edits, pick, edit, reset: path => edit(path, undefined), resetAll: () => setEdits({}), has: path => getPath(edits, path) !== undefined, saveAs, rename, remove, importText, exportText };
}
