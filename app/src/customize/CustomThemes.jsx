import { useState } from "react";
import { toast } from "../toast.js";
import { allThemes } from "../theme/presets.js";
// Themes tab: choose a built-in or saved theme, save the current look as a new one, rename, delete, export and import.
export default function CustomThemes({ c }) {
  const [name, setName] = useState(""), [renaming, setRenaming] = useState(null), [text, setText] = useState(""), [msg, setMsg] = useState(null), [copied, setCopied] = useState(false);
  const save = () => { c.saveAs(name || "My theme"); setName(""); };
  const doImport = () => { const r = c.importText(text); setMsg(r.ok ? { ok: true, t: `Added "${r.theme.name}".` } : { ok: false, t: r.error }); if (r.ok) setText(""); };
  const copy = () => navigator.clipboard?.writeText(c.exportText()).then(() => { toast("Copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  return (
    <div className="ctab">
      <div className="cthemes" role="listbox" aria-label="Themes">
        {allThemes(c.themes).map(t => (
          <div key={t.id} className={"cth" + (c.id === t.id ? " on" : "")}>
            {renaming === t.id
              ? <input autoFocus defaultValue={t.name} aria-label="Theme name" onBlur={e => { c.rename(t.id, e.target.value); setRenaming(null); }} onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRenaming(null); }} />
              : <button role="option" aria-selected={c.id === t.id} className="cpick" onClick={() => c.pick(t.id)}>{t.name}{c.id === t.id && c.dirty ? " (changed)" : ""}</button>}
            {!t.builtIn && renaming !== t.id && <><button onClick={() => setRenaming(t.id)}>Rename</button><button className="danger" onClick={() => c.remove(t.id)}>Delete</button></>}
          </div>))}
      </div>
      <h5 className="chd">Save the current look</h5>
      <div className="cwrite"><input value={name} placeholder="Name for the new theme" aria-label="New theme name" onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} /><button className="cta" onClick={save}>Save as new theme</button></div>
      <h5 className="chd">Share</h5>
      <div className="cwrite"><button onClick={copy}>{copied ? "Copied" : "Copy this look as JSON"}</button></div>
      <textarea value={text} placeholder="Paste a theme here to import it" aria-label="Theme to import" rows={4} onChange={e => { setText(e.target.value); setMsg(null); }} />
      <div className="cwrite"><button disabled={!text.trim()} onClick={doImport}>Import</button>{msg && <span className={msg.ok ? "cok" : "cwarn"} role="status">{msg.t}</span>}</div>
    </div>);
}
