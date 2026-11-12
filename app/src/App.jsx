import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card.jsx";
import Compact from "./Compact.jsx";
import ActivityDrawer from "./ActivityDrawer.jsx";
import Machines from "./Machines.jsx";
import MoreMenu from "./MoreMenu.jsx";
import { Clock, Ago } from "./Clock.jsx";
import * as api from "./api.js";
import { isWarn, hm } from "./format.js";
import { DEFAULT_PREFS } from "./alerts.js";
import { unseenFailures } from "./events.js";
import { RANGES, snapRange, SHORT, KEYS } from "./consts.js";
import { load, save, usePersisted } from "./store.js";
import useAlerts from "./useAlerts.js";
import useCollectorData from "./useCollectorData.js";
import useUpdates from "./useUpdates.js";
import useWindowMode from "./useWindowMode.js";
import useShortcuts from "./useShortcuts.js";
import useLook from "./useLook.js";

export default function App() {
  const [range, setRange] = usePersisted("range", () => 300), [refresh, setRefresh] = usePersisted("refresh", 3), [auto, setAuto] = usePersisted("auto", true);
  const safeRange = snapRange(range);
  const { state, err, stamp, now, hist, events, rows, fc, retry } = useCollectorData(safeRange, refresh);
  const { pin, setPin, compact, setCompact, mini, toggleMini, prefs, setPrefs, effCompact } = useWindowMode();
  const look = useLook();
  const { upd, fail, busy, act, apply, checkNow, ready, ver, restart } = useUpdates(auto);
  const [menu, setMenu] = useState(false), [dlg, setDlg] = useState(false), [help, setHelp] = useState(false), [showEv, setShowEv] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set()), [evSeen, setEvSeen] = useState(() => load("evseen", 0));
  const [alertPrefs, setAlertPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...load("alerts", {}) }));
  const appRef = useRef(null), lastOk = useRef({}), hot = useRef({});
  useEffect(() => save("alerts", alertPrefs), [alertPrefs]);

  const ms = useMemo(() => state?.machines || [], [state]), t = now / 1000;
  ms.forEach(m => {   // remember when each machine was last seen, and how long CPU has been above its limit
    const h = hot.current[m.name] ||= {};
    if (!m.err) { lastOk.current[m.name] = m.t || t; if (isWarn("cpu", m.d?.cpu)) h.cpu ||= m.t ? m.t * 1000 : now; else h.cpu = 0; } else h.cpu = 0;
  });
  const [snoozeUntil, setSnoozeUntil] = usePersisted("snooze", 0), [fired, setFired] = usePersisted("fired", []);
  const onFire = useCallback(f => setFired(l => [f, ...l].slice(0, 100)), [setFired]);
  useAlerts(ms, hot.current, rows, alertPrefs, { fc, events, snoozeUntil, onFire });
  const log = useMemo(() => [...events, ...fired.map(f => [f.t, "🔔", `${f.title}${f.body ? " · " + f.body : ""}${f.snoozed ? " (snoozed)" : ""}`])].sort((x, y) => y[0] - x[0]), [events, fired]);

  const toggleOpen = useCallback(n => setExpanded(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; }), []);
  const effRef = useRef(false); effRef.current = effCompact;
  const open = useCallback(n => { if (effRef.current) toggleOpen(n); else setTimeout(() => document.getElementById("m-" + n)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }, [toggleOpen]);
  useEffect(() => {   // in mini mode the window is exactly as tall as its content
    if (!mini) return;
    const fit = () => { const el = appRef.current; if (!el) return; let h = 0; for (const c of el.children) if (!c.classList.contains("dock") && !c.classList.contains("modal")) h += c.offsetHeight; api.setMiniHeight(h + 2); };
    fit(); const id = setInterval(fit, 1500); const tm = setTimeout(fit, 250); return () => { clearInterval(id); clearTimeout(tm); };
  }, [mini, state]);

  const unseen = useMemo(() => unseenFailures(events, evSeen), [events, evSeen]);
  const markSeen = () => { const x = Date.now() / 1000; setEvSeen(x); save("evseen", x); };
  const openEv = () => { setShowEv(true); markSeen(); }, closeEv = () => { setShowEv(false); markSeen(); };
  useShortcuts({ dlg, setDlg, help, setHelp, menu, setMenu, showEv, closeEv, openEv, ms, open, ranges: RANGES, range: safeRange, setRange, setCompact, toggleMini, setPin });

  const card = m => <Card key={m.name} m={m} h={hist[m.name]} rows={rows} fc={fc[m.name]} range={safeRange} now={now / 1000} lastOk={lastOk.current[m.name]} hot={hot.current[m.name] || {}} gone={m.gone || []} onOpen={open} onTry={retry} />;   // `open` toggles the row in compact view and scrolls to the card otherwise
  return (
    <div className={"app" + (err && state ? " stale" : "")} ref={appRef} onClick={() => menu && setMenu(false)}>
      <div className="bar top">
        {!effCompact && <span className="brand"><b>XERO</b> SYSTEMS MONITOR</span>}
        <span className="live"><i className={"dot" + (err ? " off" : "")} /><Ago err={err} stamp={stamp} short={effCompact} /></span>
        <span className="grow" />
        {!effCompact && <span className="live hide-s clock"><Clock /></span>}
        {!mini && <button className={pin ? "on" : ""} onClick={() => setPin(!pin)} data-tip="Always on top (T)">{effCompact ? "Top" : "On top"}</button>}
        {!mini && <button className={compact ? "on" : ""} onClick={() => setCompact(!compact)} data-tip="Compact view: one row per machine (C)">Compact</button>}
        {!mini && <button onClick={toggleMini} data-tip="Small always-on-top corner view (M)">Mini</button>}
        {mini && <button className="on" onClick={toggleMini} data-tip="Back to the normal window (M)">Expand</button>}
      </div>

      {err && state && <div className="stalebar" role="status"><b>Collector not answering since {hm(stamp / 1000)}.</b> Showing the last numbers it sent; they are not live. Retrying every few seconds.<button onClick={retry}>Try now</button></div>}
      {!state && <div className="empty">{err ? <>Waiting for the collector…<small>{err}</small></> : "Loading…"}</div>}


      {state && effCompact && <Compact ms={ms} now={now} lastOk={lastOk.current} hot={hot.current} expanded={expanded} onToggle={toggleOpen} renderCard={card} />}
      {state && !effCompact && <main className="grid">{ms.map(card)}</main>}

      <div className="dock" hidden={mini} onClick={e => e.stopPropagation()}>
      {showEv && <ActivityDrawer events={log} onClose={closeEv} />}
      <div className="bar foot">
        <button className={showEv ? "on" : ""} onClick={() => (showEv ? closeEv() : openEv())} data-tip="Activity drawer (E)">Activity{unseen > 0 && !showEv && <span className="badge">{unseen}</span>}</button>
        {!effCompact && <span className="lbl hide-s">Graphs show</span>}
        <div className="seg" role="group" aria-label="Time range">{RANGES.map(([l, s]) => <button key={s} className={safeRange === s ? "on" : ""} onClick={() => setRange(s)}>{effCompact ? SHORT(l) : l}</button>)}</div>
        <span className="grow" />
        {ready && <button className="cta" onClick={restart} data-tip="The new version is installed. Restart to use it.">Restart to finish updating</button>}
        {upd && !ready && <button className="cta" disabled={!!busy} onClick={apply}>{busy === "u" ? "Updating…" : "Update available"}</button>}
        <MoreMenu open={menu} setOpen={setMenu} prefs={prefs} setPrefs={setPrefs} refresh={refresh} setRefresh={setRefresh} alertPrefs={alertPrefs} setAlertPrefs={setAlertPrefs}
          auto={auto} setAuto={setAuto} upd={upd} fail={fail} busy={busy} ready={ready} ver={ver} look={look} snoozeUntil={snoozeUntil} setSnoozeUntil={setSnoozeUntil} onCheck={checkNow}
          onMachines={() => setDlg(true)} onHelp={() => setHelp(true)} onMini={toggleMini} onRestart={() => act("r", () => api.restartCollector())}
          onStop={() => window.confirm("Stop everything? The monitor and its collector will close until you open it again.") && act("s", () => api.stopEverything())} />
      </div>
      </div>
      {dlg && <Machines onClose={() => setDlg(false)} />}
      {help && <div className="modal" onClick={() => setHelp(false)}><div className="dlg" onClick={e => e.stopPropagation()}><h3>Keyboard shortcuts</h3>{KEYS.map(([k, t]) => <div className="mrow" key={k}><kbd>{k}</kbd><span>{t}</span></div>)}<div className="mfoot"><button className="cta" onClick={() => setHelp(false)}>Close</button></div></div></div>}
    </div>
  );
}
