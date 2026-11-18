import { useState } from "react";
import { toast } from "./toast.js";
// The result of a service action: a short success or error line. When sudo needs a password it shows the command to run yourself, with a Copy button. Passwords are never asked for or kept.
export default function ActionNote({ note, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!note) return null;
  const copy = () => { try { navigator.clipboard.writeText(note.cmd).then(() => { toast("Copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); } catch { /* clipboard blocked */ } };
  return (
    <div className={"sysnote" + (note.ok ? " ok" : note.cmd ? " ask" : " bad")} role={note.ok ? "status" : "alert"}>
      {note.cmd ? <><span>Needs your password — run this yourself:</span><code>{note.cmd}</code><button className="ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button></> : <span>{note.text}</span>}
      <button className="ghost" onClick={onClose} aria-label="Dismiss">×</button>
    </div>);
}
