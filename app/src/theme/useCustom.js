import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getPath, setPath, mergeLook } from "./model.js";
import { useOsAccent } from "./os.js";
import { sideOf, fillSlot, activeId, cleanAppearance, bake, hasEdits } from "./appearance.js";
import * as api from "../api.js";
import { lookToCss } from "./css.js";
import { normTheme, exportTheme, parseTheme, newId } from "./files.js";
import { allThemes, cleanEditsBy, pruneShared, resolveTheme, makeTheme } from "./presets.js";
import useChosen from "./useChosen.js";
import { startHistory, record, undo, redo, canUndo, canRedo } from "./history.js";
// The custom look as the window uses it: what is chosen (useChosen: saved themes, One theme or Follow Windows, the Light and Dark slots) and each tile's own edits, all in the settings store.
// The result is written once to <html> as custom properties and data attributes, so nothing re-renders; charts read colours through colors.js, which watches <html>.
// Undo and redo keep the steps of this session (they live here, not in the panel, so closing the panel keeps them; they are not saved between runs).
const NO_EDITS = {};
let applied = [];
function apply({ vars, attrs }) {
  const el = document.documentElement;
  for (const k of applied) if (!(k in vars) && !(k in attrs)) el.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  applied = [...Object.keys(vars), ...Object.keys(attrs)];
}

export default function useCustom() {
  const ch = useChosen(), { themes, all, appearance, themeId, slots, editsBy, shared, sysLight, id, theme, look: own } = ch, [slot, setSlot] = useState(null);
  const hist = useRef(null), [, bump] = useReducer(n => n + 1, 0), [comparing, setComparing] = useState(false), opened = useRef(null);
  if (!hist.current) hist.current = startHistory({ themeId, slots, editsBy, shared });
  const side = sideOf(theme), mine = editsBy[id] || NO_EDITS, picked = slot || side;   // the slot being filled: the one that is showing until another is clicked
  const was = useMemo(() => {
    if (!opened.current) return null;
    const o = opened.current;
    return resolveTheme(themes, activeId({ appearance, themeId: o.themeId, slots: o.slots }, sysLight, all), o.editsBy, o.shared);
  }, [themes, all, comparing, appearance, sysLight]);   // eslint-disable-line react-hooks/exhaustive-deps -- the look from when the panel opened
  const shown = comparing && was ? was : { theme, look: own };   // holding the eye only shows the old look; nothing is saved
  const osOn = !!getPath(shown.look, ["surface", "os"]), accent = useOsAccent(osOn);   // "Use Windows accent colour"
  const lookNow = useMemo(() => (osOn && accent ? mergeLook(shown.look, { colors: { acc: accent } }) : shown.look), [shown.look, osOn, accent]);
  const css = useMemo(() => lookToCss(lookNow, { base: sideOf(shown.theme) }), [lookNow, shown.theme]);
  const base = css.attrs["data-theme"];   // light or dark: always worked out from the background that is shown, never saved
  useEffect(() => apply(css), [css]);
  useEffect(() => { api.setTheme(base); }, [base]);

  const commit = useCallback(({ themes: made, ...patch }, key) => {
    const n = { themeId, slots, editsBy, shared, ...patch };
    n.editsBy = cleanEditsBy(n.editsBy, made ? allThemes(made) : all);   // a colour edit stays only while it differs from its theme
    n.shared = pruneShared(theme, n.shared);   // a shared edit stays only while it changes something on the theme showing
    hist.current = record(hist.current, n, key); ch.setThemeId(n.themeId); ch.setSlots(n.slots); ch.setEditsBy(n.editsBy); ch.setShared(n.shared); bump();
  }, [themeId, slots, editsBy, shared, theme, all, ch]);
  const jump = useCallback(h => { hist.current = h; ch.setThemeId(h.present.themeId); ch.setSlots(h.present.slots); ch.setEditsBy(h.present.editsBy); ch.setShared(h.present.shared); bump(); }, [ch]);
  const mineWith = useCallback(e => ({ ...editsBy, [id]: e }), [editsBy, id]);
  // Put `tile` to use: as the one theme, or in the slot being filled (only a light tile fits Light and a dark one Dark). False when it does not fit.
  const place = useCallback((tile, into) => {
    if (!tile) return false;
    if (appearance === "one") { commit({ themeId: tile.id }); return true; }
    const next = fillSlot(slots, into, tile); if (next === slots) return false;
    commit({ slots: next }); setSlot(into); return true;
  }, [appearance, slots, commit]);
  const pick = useCallback(tid => place(all.find(x => x.id === tid), picked), [all, place, picked]);
  const setAppearance = useCallback(a => {   // the tile showing stays showing: it becomes the one theme, or goes in the slot of its side
    const next = cleanAppearance(a); if (next === appearance) return;
    if (next === "one") commit({ themeId: id }); else commit({ slots: fillSlot(slots, side, theme) });
    ch.setAppearance(next); setSlot(null);
  }, [appearance, id, slots, side, theme, commit, ch]);
  // A colour edit belongs to the tile showing; every other edit is shared by all tiles.
  const editMany = useCallback((pairs, key) => {
    const set = (e, [p, v]) => setPath(e, p.split("."), v), colours = pairs.filter(([p]) => p.startsWith("colors.")), rest = pairs.filter(([p]) => !p.startsWith("colors."));
    commit({ editsBy: colours.length ? mineWith(colours.reduce(set, mine)) : editsBy, shared: rest.reduce(set, shared) }, key);
  }, [commit, mineWith, mine, editsBy, shared]);
  const edit = useCallback((path, value) => editMany([[path.join("."), value]], path.join(".")), [editMany]);
  const without = useCallback(tid => Object.fromEntries(Object.entries(editsBy).filter(([k]) => k !== tid)), [editsBy]);
  const add = useCallback((list, tiles, cleared) => {   // new tiles saved; the first one is put to use
    const all2 = [...themes, ...list];
    ch.setSaved(all2);
    const first = tiles[0], into = sideOf(first), withNew = { ...cleared };
    if (appearance === "one") commit({ themeId: first.id, editsBy: withNew, themes: all2 }); else commit({ slots: fillSlot(slots, into, first), editsBy: withNew, themes: all2 });
    setSlot(into);
  }, [themes, appearance, slots, ch, commit]);
  const saveAs = useCallback(name => { const t = makeTheme(themes, name, bake(theme, mine, shared)); add([t], [t], without(id)); }, [add, themes, theme, mine, shared, without, id]);
  const save = useCallback(() => { if (theme && !theme.builtIn) { ch.setSaved(themes.map(t => (t.id === id ? { ...t, ...bake(t, mine, shared) } : t))); commit({ editsBy: without(id) }); } }, [theme, themes, id, mine, shared, ch, commit, without]);
  const rename = useCallback((tid, name) => ch.setSaved(themes.map(t => (t.id === tid ? normTheme({ ...t, name }) : t))), [themes, ch]);
  const remove = useCallback(tid => { ch.setSaved(themes.filter(t => t.id !== tid)); commit({ themeId: themeId === tid ? "dark" : themeId, editsBy: without(tid) }); }, [themes, themeId, ch, commit, without]);
  const importText = useCallback(text => {
    const r = parseTheme(text); if (!r.ok) return r;
    const taken = allThemes(themes).map(t => t.id), made = r.themes.map(t => { const n = { ...t, id: newId(t.name, taken) }; taken.push(n.id); return n; });
    add(made, made, editsBy); return r;
  }, [add, themes, editsBy]);
  const exportText = useCallback(() => exportTheme({ name: theme?.name || "My look", ...bake(theme, mine, shared) }), [theme, mine, shared]);
  // Called when the panel opens: what you see now is what the eye button shows again.
  const remember = useCallback(() => { opened.current = { themeId, slots, editsBy, shared }; }, [themeId, slots, editsBy, shared]);
  return { themes, all, id, theme, look: shown.look, own, base, dirty: hasEdits(mine) || hasEdits(shared), dirtyColors: hasEdits(mine), dirtyShared: hasEdits(shared), appearance, setAppearance, slots, slot: picked, setSlot, sysLight, side, canSave: !!theme && !theme.builtIn, edits: mine, pick, edit, editMany,
    reset: path => edit(path, undefined), resetAll: () => commit({ editsBy: without(id) }), resetShared: () => commit({ shared: NO_EDITS }), has: path => getPath(path[0] === "colors" ? mine : shared, path) !== undefined,
    save, saveAs, rename, remove, importText, exportText, remember, setComparing, comparing,
    undo: () => jump(undo(hist.current)), redo: () => jump(redo(hist.current)), canUndo: canUndo(hist.current), canRedo: canRedo(hist.current) };
}
