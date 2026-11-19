import { useContext, useRef, useState } from "react";
import { Find, Seg } from "./controls.jsx";
import { matches } from "./find.js";
import { toast } from "../toast.js";
import { themeTitle, bySide } from "../theme/presets.js";
import { APPEARANCES, sideOf } from "../theme/appearance.js";
import { fullColors } from "../theme/css.js";
import Thumb from "./Thumb.jsx";
const DARK_ONLY = "Terminal, Dracula, Neon, Midnight and Blueprint are dark only, so they are not listed here.";
// A tile is one version of a theme. While following Windows the tiles in the two slots carry a small LIGHT or DARK badge; the one showing now has the accent ring.
const Tile = ({ t, on, badge, held, note, onPick }) => (
  <button role="option" aria-selected={on} className={"ctile" + (on ? " on" : "") + (held && !on ? " held" : "")} onClick={() => onPick(t.id)}><Thumb theme={t} />
    {badge && <span className={"cbadge" + (on ? "" : " idle")}>{badge}</span>}<span className="ctname">{t.name}</span>{note && <em>{note}</em>}</button>);
const Slot = ({ s, label, c }) => {
  const t = c.all.find(x => x.id === c.slots[s]), sw = fullColors(t.look, sideOf(t)), now = c.sysLight === (s === "light");
  return (
    <button className={"cslot" + (c.slot === s ? " pick" : "")} aria-pressed={c.slot === s} data-slot={s} onClick={() => c.setSlot(s)}>
      <small>{label}{now && <b>active now</b>}</small><span><i style={{ background: sw.bg, borderColor: sw.acc }} />{t.name}<u>▾</u></span></button>);
};
// Theme: the gallery (built in, popular palettes, yours), Save / Save as new / Revert for the look in use, and sharing (copy code, export file, import).
export default function ThemeSection({ c }) {
  const [renaming, setRenaming] = useState(null), [naming, setNaming] = useState(false), [name, setName] = useState(""), [text, setText] = useState(""), [msg, setMsg] = useState(null), [copied, setCopied] = useState(false), file = useRef(null);
  const note = t => (c.id === t.id && c.dirty ? "changed" : "");
  const follow = c.appearance === "system", groups = bySide(c.all);
  const onPick = tid => { if (!c.pick(tid)) toast(`${c.slot === "light" ? "Only light" : "Only dark"} tiles fit the ${c.slot === "light" ? "Light" : "Dark"} slot. Click the other slot to fill that one.`); };
  const q = useContext(Find), tiles = (list, s) => { const some = list.filter(t => !q || matches(q, t.name, "theme palette")); return some.length ? <div className={"cgrid" + (q ? " hit" : "")} role="listbox" aria-label={s + " themes"}>{some.map(t => <Tile key={t.id} t={t} on={c.id === t.id} held={follow && c.slots[s] === t.id} badge={follow && c.slots[s] === t.id ? s.toUpperCase() : ""} note={note(t)} onPick={onPick} />)}</div> : null; };
  const saveNew = () => { c.saveAs(name || "My theme"); setName(""); setNaming(false); };
  const doImport = pasted => { const r = c.importText(typeof pasted === "string" ? pasted : text); setMsg(r.ok ? { ok: true, t: `Added "${r.theme.name}".` } : { ok: false, t: r.error }); if (r.ok) setText(""); };
  const copy = () => navigator.clipboard?.writeText(c.exportText()).then(() => { toast("Copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([c.exportText()], { type: "application/json" })); a.download = (c.theme?.name || "theme").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".xsm-theme.json"; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <>
      <div className="crow" data-setting="mode"><span className="clabel">Appearance</span><div className="cctl"><Seg label="Appearance" value={c.appearance} options={APPEARANCES} onChange={c.setAppearance} /></div>
        {follow && <div className="cslots"><Slot s="light" label="Light" c={c} /><Slot s="dark" label="Dark" c={c} /></div>}
        <p className="chint">{follow ? `Windows is set to ${c.sysLight ? "light" : "dark"} now, so ${c.theme?.name} is showing. Click a slot, then a tile below to change it.` : "One theme, always. Click any tile to use it."}</p></div>
      <div className="cnow" role="status"><b>{themeTitle(c.theme, c.dirty)}</b>
        <span className="cbtns"><button disabled={!c.dirty || !c.canSave} onClick={c.save} data-tip={c.canSave ? "Keep your changes in this theme" : "Built-in themes stay as they are: use Save as new"}>Save</button>
          <button onClick={() => setNaming(n => !n)} aria-expanded={naming}>Save as new</button><button disabled={!c.dirty} onClick={c.resetAll}>Revert</button></span></div>
      <p className="chint">Your edits are kept per theme.</p>
      {naming && <div className="cwrite"><input autoFocus value={name} placeholder="Name for the new theme" aria-label="New theme name" onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveNew()} /><button className="cta" onClick={saveNew}>Save</button></div>}
      <h5 className="chd">Dark themes<i>{groups.dark.length}</i></h5>{tiles(groups.dark, "dark")}
      <h5 className="chd">Light themes<i>{groups.light.length}</i></h5><p className="chint">{DARK_ONLY}</p>{tiles(groups.light, "light")}
      {c.themes.length > 0 && <><h5 className="chd">Your themes</h5>
        <ul className="cmine">{c.themes.map(t => (
          <li key={t.id}>{renaming === t.id
            ? <input autoFocus defaultValue={t.name} aria-label="Theme name" onBlur={e => { c.rename(t.id, e.target.value); setRenaming(null); }} onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRenaming(null); }} />
            : <span>{t.name}</span>}
            <button onClick={() => setRenaming(t.id)}>Rename</button><button className="danger" onClick={() => c.remove(t.id)}>Delete</button></li>))}</ul></>}
      <h5 className="chd">Share</h5>
      <div className="cwrite"><button onClick={copy}>{copied ? "Copied" : "Copy code"}</button><button onClick={download}>Export</button><button onClick={() => file.current?.click()}>Import</button>
        <input ref={file} type="file" accept=".json,application/json" hidden aria-label="Theme file to import" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) f.text().then(doImport); }} /></div>
      <textarea value={text} placeholder="Paste a theme code here to import it" aria-label="Theme to import" rows={3} onChange={e => { setText(e.target.value); setMsg(null); }} />
      <div className="cwrite"><button disabled={!text.trim()} onClick={() => doImport()}>Import</button>{msg && <span className={msg.ok ? "cok" : "cwarn"} role="status">{msg.t}</span>}</div>
    </>);
}
