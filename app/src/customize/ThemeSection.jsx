import { useContext, useRef, useState } from "react";
import { Find, Seg } from "./controls.jsx";
import { matches } from "./find.js";
import { toast } from "../toast.js";
import { PRESETS, BUILT_IN_COUNT, themeTitle } from "../theme/presets.js";
import { MODES, lookFor } from "../theme/modes.js";
import { fullColors } from "../theme/css.js";
import Thumb from "./Thumb.jsx";
// A theme tile shows the version for the current mode, and a tiny half-and-half swatch of both versions.
const half = (t, s) => fullColors(lookFor(t, {}, s), s).bg;
const Tile = ({ t, side, on, note, onPick }) => (
  <button role="option" aria-selected={on} className={"ctile" + (on ? " on" : "")} onClick={() => onPick(t.id)}><Thumb theme={t} side={side} />
    <span className="ctname">{t.name}<i className="cdual" aria-label="Has a dark and a light version" style={{ background: `linear-gradient(135deg, ${half(t, "dark")} 50%, ${half(t, "light")} 50%)` }} /></span>{note && <em>{note}</em>}</button>);
// Theme: the gallery (built in, popular palettes, yours), Save / Save as new / Revert for the look in use, and sharing (copy code, export file, import).
export default function ThemeSection({ c }) {
  const [renaming, setRenaming] = useState(null), [naming, setNaming] = useState(false), [name, setName] = useState(""), [text, setText] = useState(""), [msg, setMsg] = useState(null), [copied, setCopied] = useState(false), file = useRef(null);
  const note = t => (c.id === t.id && c.dirty ? "changed" : "");
  const q = useContext(Find), tiles = list => { const some = list.filter(t => !q || matches(q, t.name, "theme palette")); return some.length ? <div className={"cgrid" + (q ? " hit" : "")} role="listbox" aria-label="Themes">{some.map(t => <Tile key={t.id} t={t} side={c.side} on={c.id === t.id} note={note(t)} onPick={c.pick} />)}</div> : null; };
  const saveNew = () => { c.saveAs(name || "My theme"); setName(""); setNaming(false); };
  const doImport = pasted => { const r = c.importText(typeof pasted === "string" ? pasted : text); setMsg(r.ok ? { ok: true, t: `Added "${r.theme.name}".` } : { ok: false, t: r.error }); if (r.ok) setText(""); };
  const copy = () => navigator.clipboard?.writeText(c.exportText()).then(() => { toast("Copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([c.exportText()], { type: "application/json" })); a.download = (c.theme?.name || "theme").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".xsm-theme.json"; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <>
      <div className="crow" data-setting="mode"><span className="clabel">Appearance</span><div className="cctl"><Seg label="Appearance" value={c.mode} options={MODES} onChange={c.setMode} /></div>
        <p className="chint">Every theme has a dark and a light version. Windows follows your system setting.</p></div>
      <div className="cnow" role="status"><b>{themeTitle(c.theme, c.dirty)}</b>
        <span className="cbtns"><button disabled={!c.dirty || !c.canSave} onClick={c.save} data-tip={c.canSave ? "Keep your changes in this theme" : "Built-in themes stay as they are: use Save as new"}>Save</button>
          <button onClick={() => setNaming(n => !n)} aria-expanded={naming}>Save as new</button><button disabled={!c.dirty} onClick={c.resetAll}>Revert</button></span></div>
      {naming && <div className="cwrite"><input autoFocus value={name} placeholder="Name for the new theme" aria-label="New theme name" onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveNew()} /><button className="cta" onClick={saveNew}>Save</button></div>}
      <h5 className="chd">Built in</h5>{tiles(PRESETS.slice(0, BUILT_IN_COUNT))}
      <h5 className="chd">Popular palettes</h5>{tiles(PRESETS.slice(BUILT_IN_COUNT))}
      {c.themes.length > 0 && <><h5 className="chd">Your themes</h5>{tiles(c.themes)}
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
