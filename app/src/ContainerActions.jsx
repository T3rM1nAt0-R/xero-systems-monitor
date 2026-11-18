import { useState, useEffect, useCallback } from "react";
import { toast } from "./toast.js";
import * as api from "./api.js";
import useEscape from "./useEscape.js";
import HoldButton from "./HoldButton.jsx";
const VERB = { restart: "Restart", stop: "Stop", start: "Start" };
// The Logs dialog: the last 50 lines, with Refresh and Copy.
export function ContainerLogs({ machine, name, onClose }) {
  useEscape(onClose);
  const [text, setText] = useState("Loading…"), [copied, setCopied] = useState(false);
  const load = useCallback(() => { setText("Loading…"); api.containerAction(machine, "logs", name).then(t => setText(t || "(no log lines)"), e => setText(String(e))); }, [machine, name]);
  useEffect(load, [load]);
  const copy = () => { try { navigator.clipboard.writeText(text).then(() => { toast("Copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); } catch { /* clipboard blocked */ } };
  return (
    <div className="modal" onClick={onClose}>
      <div className="dlg logdlg" role="dialog" aria-label={`Logs of ${name}`} onClick={e => e.stopPropagation()}>
        <h3>Logs of {name}</h3>
        {text === "Loading…" ? <div className="skelrows" aria-busy="true" aria-label="Loading"><i /><i /><i /><i /><i /></div> : <pre className="logtext">{text}</pre>}
        <div className="mfoot"><button onClick={load}>Refresh</button><button onClick={copy}>{copied ? "Copied" : "Copy"}</button><button className="cta" onClick={onClose}>Close</button></div>
      </div>
    </div>);
}
// Small buttons on one container row: Restart and Stop (hold the button to confirm), Start, and Logs.
export default function ContainerActions({ machine, name, running }) {
  const [ask, setAsk] = useState(null), [busy, setBusy] = useState(false), [note, setNote] = useState(null), [logs, setLogs] = useState(false);
  const run = async action => {
    setBusy(true); setAsk(null);
    try { setNote({ ok: true, text: await api.containerAction(machine, action, name) }); } catch (e) { setNote({ ok: false, text: String(e) }); }
    setBusy(false);
  };
  const acts = running ? ["restart", "stop"] : ["start"];
  return (
    <span className="cacts">
      {ask ? <><span className="cask">{VERB[ask]} {name}?</span><HoldButton disabled={busy} label={`Hold to ${ask}`} title={`Keep holding to ${ask} ${name}`} onDone={() => run(ask)} /><button className="ghost" onClick={() => setAsk(null)}>Cancel</button></>
        : <>{acts.map(a => <button key={a} className="ghost" disabled={busy} onClick={() => { setNote(null); if (a === "start") run(a); else setAsk(a); }}>{VERB[a]}</button>)}<button className="ghost" onClick={() => setLogs(true)}>Logs</button></>}
      {busy && <span className="cnote">Working…</span>}
      {note && <span className={"cnote" + (note.ok ? "" : " bad")} role={note.ok ? "status" : "alert"}>{note.text}</span>}
      {logs && <ContainerLogs machine={machine} name={name} onClose={() => setLogs(false)} />}
    </span>);
}
