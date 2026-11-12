import { useEffect, useState } from "react";
import * as api from "./api.js";
// Updates and the one-at-a-time "busy" marker for the buttons that wait (update, check, restart, stop).
export default function useUpdates(auto) {
  const [upd, setUpd] = useState(null), [fail, setFail] = useState(false), [busy, setBusy] = useState(""), [ready, setReady] = useState(false), [ver, setVer] = useState(null);
  useEffect(() => { api.version().then(setVer); }, [ready]);
  const apply = async () => {   // installs in the background; the window keeps running until you press "Restart to finish updating"
    setBusy("u"); const r = await api.applyUpdate(); setBusy("");
    if (r === true) { setReady(true); setUpd(null); } else { setUpd(null); setFail(r === "dirty" ? "dirty" : true); }
  };
  useEffect(() => {   // check every 10 minutes; install by itself when "Update by itself" is on
    let live = true;
    const chk = async () => { if (document.hidden) return; const u = await api.checkForUpdates(); if (!live) return; setUpd(u); if (u && auto) await apply(); };
    chk(); const id = setInterval(chk, 600000); return () => { live = false; clearInterval(id); };
  }, [auto]);
  const act = async (name, fn) => { setBusy(name); try { await fn(); } finally { setBusy(""); } };
  const checkNow = () => act("c", async () => { setFail(false); const u = await api.checkForUpdates(); setUpd(u); if (u) await apply(); });
  return { upd, fail, busy, act, apply, checkNow, ready, ver, restart: () => api.relaunch() };
}
