import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api.js";
import { errorText, passwordCommand } from "./system.js";
// Reading one machine's services or updates from the shell: { text, err, loading, reload }. Looks again every `every` ms (0 = only on demand).
export function useSystemQuery(machine, query, every = 0) {
  const [s, setS] = useState({ text: null, err: "", loading: true }), seq = useRef(0);
  const reload = useCallback(() => {
    const n = ++seq.current;
    setS(p => ({ ...p, loading: true }));
    api.systemQuery(machine, query).then(text => n === seq.current && setS({ text, err: "", loading: false }), e => n === seq.current && setS({ text: null, err: errorText(e), loading: false }));
  }, [machine, query]);
  useEffect(() => { reload(); if (!every) return undefined; const id = setInterval(reload, every); return () => clearInterval(id); }, [reload, every]);
  return { ...s, reload };
}
// Doing things to one machine: run(act, name) resolves when done. note is { ok, text, cmd } for the banner (cmd: what to run by hand when sudo wants a password).
export function useSystemAction(machine, onDone) {
  const [busy, setBusy] = useState(null), [note, setNote] = useState(null);
  const run = useCallback(async (act, name = "") => {
    setBusy(act + name); setNote(null);
    try { setNote({ ok: true, text: await api.systemAction(machine, act, name) }); onDone?.(); } catch (e) { setNote({ ok: false, text: errorText(e), cmd: passwordCommand(e) }); }
    setBusy(null);
  }, [machine, onDone]);
  return { run, busy, note, clear: () => setNote(null) };
}
