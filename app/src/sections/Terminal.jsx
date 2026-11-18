import { useEffect, useRef, useState } from "react";
import { get, set, useSetting } from "../store.js";
import { emptyTerms, addTerm, closeTerm, pickTerm, sessionTitle, MAX_SESSIONS } from "../terminal.js";
// The Terminal section: a real shell per machine, with several sessions as small sub-tabs (+ opens one, x closes it).
// The terminal library (xterm) is loaded when this opens for the first time; the sessions live in termHost.js, so they survive switching tabs.
let uid = 0;
let hostModule = null;
const loadHost = () => (hostModule ||= import("../termHost.js"));

// A shell needs a machine that answers; an offline one just says so.
export default function Terminal({ m }) { return m.err ? <div className="quiet">Machine is offline.</div> : <Shell m={m} />; }
function Shell({ m }) {
  const key = "term." + m.name;
  const [terms] = useSetting(key, emptyTerms);
  const [host, setHost] = useState(null), [, tick] = useState(0);
  const box = useRef(null);
  useEffect(() => { let alive = true; loadHost().then(h => alive && setHost(h)); return () => { alive = false; }; }, []);
  const update = f => set(key, f(get(key, terms)), { persist: false });
  // Make sure every listed session is started (this also restarts the visible one after the window was reloaded).
  useEffect(() => { if (host) for (const s of terms.items) host.open(s.id, m.name, () => tick(n => n + 1)); }, [host, terms.items, m.name]);
  // The first time the tab opens, start one shell for the user.
  useEffect(() => { if (host && terms.items.length === 0 && terms.next === 1) update(t => addTerm(t, m.name, ++uid)); }, [host]);   // eslint-disable-line react-hooks/exhaustive-deps -- only when the library has arrived
  useEffect(() => (host && terms.active && box.current ? host.show(terms.active, box.current) : undefined), [host, terms.active]);
  const st = host && terms.active ? host.state(terms.active) : { got: false, ended: false };
  const close = id => { host?.close(id); update(t => closeTerm(t, id)); };
  return (
    <div className="term">
      <div className="termtabs" role="tablist" aria-label="Terminals">
        {terms.items.map(s => (
          <span key={s.id} className={"termtab" + (s.id === terms.active ? " on" : "")}>
            <button role="tab" aria-selected={s.id === terms.active} onClick={() => update(t => pickTerm(t, s.id))}>{sessionTitle(s)}</button>
            <button className="x" aria-label={`Close ${sessionTitle(s)}`} title="Close" onClick={() => close(s.id)}>×</button>
          </span>))}
        <button className="termadd" aria-label="New terminal" title="New terminal" disabled={terms.items.length >= MAX_SESSIONS} onClick={() => update(t => addTerm(t, m.name, ++uid))}>+</button>
      </div>
      <div className="termbody">
        {terms.active && !st.got && <div className="termload" role="progressbar" aria-label="Connecting"><i /><span>Connecting…</span></div>}
        {terms.active ? <div className="termbox" ref={box} /> : <div className="termempty">{host ? "No terminals open. Press + to start one." : "Loading the terminal…"}</div>}
      </div>
    </div>);
}
