import { useEffect, useRef, useState } from "react";
import * as api from "../api.js";
import { toast } from "../toast.js";
import { adminRows, asAdmin, ADMIN_NOTE } from "../admin.js";
// "Admin shell…" in the Terminal tab (This PC only, app not elevated): a small menu of the three ways to get an administrator shell.
export default function AdminMenu({ elevated, sudo, onTab }) {
  const [open, setOpen] = useState(false), box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const pick = id => {
    setOpen(false);
    if (id === "tab") onTab();
    else asAdmin(id === "window" ? api.openAdminShellWindow : api.restartAsAdmin, toast);
  };
  return (
    <span className="adminmenu" ref={box}>
      <button className="termadd" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>Admin shell…</button>
      {open && <div className="adminpop" role="menu">
        {adminRows({ elevated, sudo }).map(r => (
          <button key={r.id} role="menuitem" disabled={r.disabled} onClick={() => pick(r.id)}>
            <span>{r.label}</span>{r.hint && <em>{r.hint}</em>}
          </button>))}
        <p className="adminnote">{ADMIN_NOTE}</p>
      </div>}
    </span>);
}
