import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card.jsx";
import Compact from "./Compact.jsx";
import ActivityDrawer from "./ActivityDrawer.jsx";
import Machines from "./Machines.jsx";
import Strip from "./Strip.jsx";
import Palette from "./Palette.jsx";
import { buildCommands } from "./commands.js";
import { applyOrder, moveTo, stripOrder, groupsFor } from "./order.js";
import { loadGroups, saveGroups, revealGroup } from "./groupPrefs.js";
import useCardDrag from "./cardDrag.js";
import MoreMenu, { REFRESH } from "./MoreMenu.jsx";
import { Clock, Ago } from "./Clock.jsx";
import * as api from "./api.js";
import { isWarn, hm } from "./format.js";
import { limitsFor, tidyLimits } from "./limits.js";
import { DEFAULT_QUIET, mute, unmute } from "./quiet.js";
import Limits from "./Limits.jsx";
import { DEFAULT_PREFS } from "./alerts.js";
import { unseenFailures } from "./events.js";
import { RANGES, snapRange, SHORT, KEYS } from "./consts.js";
import { load, save, usePersisted } from "./store.js";
import { foldAll, CARD } from "./fold.js";
import useAlerts from "./useAlerts.js";
import useCollectorData from "./useCollectorData.js";
import useUpdates from "./useUpdates.js";
import useWindowMode from "./useWindowMode.js";
import useShortcuts from "./useShortcuts.js";
import useLook from "./useLook.js";
import useTrayStatus from "./useTrayStatus.js";
import { COMPARE } from "./graphTools.js";
import { publishHistory, setCompare, useCompare } from "./graphView.js";

export default function App() {
  const [range, setRange] = usePersisted("range", () => 300), [refresh, setRefresh] = usePersisted("refresh", 3), [auto, setAuto] = usePersisted("auto", true);
  const safeRange = snapRange(range);
  const back = useCompare();
  const { state, err, stamp, now, hist, hist2, events, rows, fc, retry } = useCollectorData(safeRange, refresh, back);
  useEffect(() => publishHistory(hist), [hist]);
  const { pin, setPin, compact, setCompact, mini, toggleMini, prefs, setPrefs, effCompact } = useWindowMode();
  const look = useLook();
  const { upd, fail, busy, act, apply, checkNow, ready, ver, restart } = useUpdates(auto);
  const [menu, setMenu] = useState(false), [pal, setPal] = useState(false), [dlg, setDlg] = useState(false), [limDlg, setLimDlg] = useState(false), [help, setHelp] = useState(false), [showEv, setShowEv] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set()), [evSeen, setEvSeen] = useState(() => load("evseen", 0));
  const [alertPrefs, setAlertPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...load("alerts", {}) }));
  const [calmFold, setCalmFold] = usePersisted("calmFold", false), [folded, setFolded] = useState(false);
  const foldMachines = useCallback(o => { setFolded(!o); foldAll(o, CARD); }, []);   // true = open them all, false = fold them all
  const appRef = useRef(null), lastOk = useRef({}), hot = useRef({});
  useEffect(() => save("alerts", alertPrefs), [alertPrefs]);
  const [limits, setLimits] = usePersisted("limits", {}), [quiet, setQuiet] = usePersisted("quiet", DEFAULT_QUIET), [muted, setMuted] = usePersisted("muted", []);

  const [localName, setLocalName] = useState("");   // which machine is this PC (the strip lists it first)
  useEffect(() => { if (!dlg) api.getMachines().then(c => setLocalName(c?.machines?.find(m => m.kind === "local")?.name || ""), () => {}); }, [dlg]);
  const [order, setOrder] = usePersisted("order", []);   // the card order you chose by dragging
  const all = useMemo(() => state?.machines || [], [state]), ms = useMemo(() => applyOrder(all, order), [all, order]), t = now / 1000;
  ms.forEach(m => {   // remember when each machine was last seen, and how long CPU has been above its limit
    const h = hot.current[m.name] ||= {};
    if (!m.err) { lastOk.current[m.name] = m.t || t; if (isWarn("cpu", m.d?.cpu, limitsFor(limits, m.name))) h.cpu ||= m.t ? m.t * 1000 : now; else h.cpu = 0; } else h.cpu = 0;
  });
  const [snoozeUntil, setSnoozeUntil] = usePersisted("snooze", 0), [fired, setFired] = usePersisted("fired", []);
  const onFire = useCallback(f => setFired(l => [f, ...l].slice(0, 100)), [setFired]);
  useAlerts(ms, hot.current, rows, alertPrefs, { fc, events, snoozeUntil, onFire, limits, quiet, muted });
  const log = useMemo(() => [...events, ...fired.map(f => [f.t, "🔔", `${f.title}${f.body ? " · " + f.body : ""}${f.snoozed ? " (snoozed)" : ""}${f.quiet ? " (quiet hours)" : ""}`, { machine: f.machine, kind: f.kind }])].sort((x, y) => y[0] - x[0]), [events, fired]);
  const onMute = useCallback((machine, kind, on) => setMuted(l => on ? mute(l, machine, kind) : unmute(l, machine, kind)), [setMuted]);

  const toggleOpen = useCallback(n => setExpanded(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; }), []);
  const effRef = useRef(false); effRef.current = effCompact;
  const open = useCallback(n => { if (effRef.current) toggleOpen(n); else setTimeout(() => document.getElementById("m-" + n)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }, [toggleOpen]);
  useEffect(() => {   // in mini mode the window is exactly as tall as its content
    if (!mini) return;
    const fit = () => { const el = appRef.current; if (!el) return; let h = 0; for (const c of el.children) if (!c.classList.contains("dock") && !c.classList.contains("modal")) h += c.offsetHeight; api.setMiniHeight(h + 2); };
    fit(); const id = setInterval(fit, 1500); const tm = setTimeout(fit, 250); return () => { clearInterval(id); clearTimeout(tm); };
  }, [mini, state]);

  const goMachine = useCallback(n => { if (effRef.current) setExpanded(s => new Set(s).add(n)); open(n); }, [open]);
  const goGroup = useCallback((n, k) => {
    const g = loadGroups(n); if (g.hidden.includes(k)) saveGroups(n, { ...g, hidden: g.hidden.filter(x => x !== k) });   // asking for a hidden group shows it again
    goMachine(n); setTimeout(() => revealGroup(n + "." + k), 120);
  }, [goMachine]);
  const dragProps = useCardDrag((from, to) => setOrder(o => moveTo(applyOrder(all, o).map(m => m.name), from, to)));
  const cmds = useMemo(() => buildCommands({ machines: ms, groupsOf: m => groupsFor(m.d), goMachine, goGroup, ranges: RANGES, setRange, look, refreshOptions: REFRESH, setRefresh, pin, setPin, compact, setCompact, toggleMini, alertPrefs, setAlert: (k, on) => setAlertPrefs(p => ({ ...p, [k]: on })), onLimits: () => setLimDlg(true), quietOn: !!quiet.on, setQuietOn: on => setQuiet(q => ({ ...DEFAULT_QUIET, ...q, on })), snooze1h: () => setSnoozeUntil(Date.now() + 3600000), onMachines: () => setDlg(true), onCheck: checkNow, foldAll: fold => foldMachines(!fold) }), [ms, foldMachines, goMachine, goGroup, look, refresh, pin, compact, alertPrefs, quiet.on, checkNow]);
  const unseen = useMemo(() => unseenFailures(events, evSeen), [events, evSeen]);
  useTrayStatus(ms, limits, unseen);
  const markSeen = () => { const x = Date.now() / 1000; setEvSeen(x); save("evseen", x); };
  const openEv = () => { setShowEv(true); markSeen(); }, closeEv = () => { setShowEv(false); markSeen(); };
  useShortcuts({ dlg, setDlg, help, setHelp, menu, setMenu, showEv, closeEv, openEv, ms, open, ranges: RANGES, range: safeRange, setRange, setCompact, toggleMini, setPin, setPal, foldMachines });

  const card = m => <Card key={m.name} m={m} h={hist[m.name]} h2={hist2[m.name]} rows={rows} fc={fc[m.name]} range={safeRange} now={now / 1000} lastOk={lastOk.current[m.name]} hot={hot.current[m.name] || {}} limits={limitsFor(limits, m.name)} auto={calmFold} flat={effCompact} gone={m.gone || []} onOpen={open} onTry={retry} />;   // `open` toggles the row in compact view and scrolls to the card otherwise
  return (
    <div className={"app" + (err && state ? " stale" : "")} ref={appRef} onClick={() => menu && setMenu(false)}>
      <div className="bar top">
        {!effCompact && <span className="brand"><b>XERO</b> SYSTEMS MONITOR</span>}
        <span className="live"><i className={"dot" + (err ? " off" : "")} /><Ago err={err} stamp={stamp} short={effCompact} /></span>
        <span className="grow" />
        {!effCompact && <span className="live hide-s clock"><Clock /></span>}
        {!effCompact && !mini && <button onClick={() => foldMachines(folded)} data-tip="Fold every machine into one bar, or open them all (F, Shift+F)">{folded ? "Unfold all" : "Fold all"}</button>}
        {!mini && <button className={pin ? "on" : ""} onClick={() => setPin(!pin)} data-tip="Always on top (T)">{effCompact ? "Top" : "On top"}</button>}
        {!mini && <button className={compact ? "on" : ""} onClick={() => setCompact(!compact)} data-tip="Compact view: one row per machine (C)">Compact</button>}
        {!mini && <button onClick={toggleMini} data-tip="Small always-on-top corner view (M)">Mini</button>}
        {mini && <button className="on" onClick={toggleMini} data-tip="Back to the normal window (M)">Expand</button>}
      </div>

      {err && state && <div className="stalebar" role="status"><b>Collector not answering since {hm(stamp / 1000)}.</b> Showing the last numbers it sent; they are not live. Retrying every few seconds.<button onClick={retry}>Try now</button></div>}
      {!state && <div className="empty">{err ? <>Waiting for the collector…<small>{err}</small></> : "Loading…"}</div>}


      {state && !effCompact && <Strip ms={stripOrder(ms, localName)} hist={hist} lastOk={lastOk.current} onOpen={n => { foldAll(true, CARD + n, true); goMachine(n); }} />}
      {state && effCompact && <Compact limits={limits} ms={ms} now={now} lastOk={lastOk.current} hot={hot.current} expanded={expanded} onToggle={toggleOpen} renderCard={card} />}
      {state && !effCompact && <main className="grid" onPointerDown={dragProps}>{ms.map(card)}</main>}

      <div className="dock" hidden={mini} onClick={e => e.stopPropagation()}>
      {showEv && <ActivityDrawer events={log} muted={muted} onMute={onMute} onClose={closeEv} />}
      <div className="bar foot">
        <button className={showEv ? "on" : ""} onClick={() => (showEv ? closeEv() : openEv())} data-tip="Activity drawer (E)">Activity{unseen > 0 && !showEv && <span className="badge">{unseen}</span>}</button>
        {!effCompact && <span className="lbl hide-s">Graphs show</span>}
        <div className="seg" role="group" aria-label="Time range">{RANGES.map(([l, s]) => <button key={s} className={safeRange === s ? "on" : ""} onClick={() => setRange(s)}>{effCompact ? SHORT(l) : l}</button>)}</div>
        {!effCompact && <label className="lbl hide-s cmpsel" data-tip="Draw a faint dashed copy of every graph from an earlier time">Compare<select value={back} onChange={e => setCompare(+e.target.value)}>{COMPARE.map(([l, s]) => <option key={s} value={s}>{l}</option>)}</select></label>}
        <span className="grow" />
        {ready && <button className="cta" onClick={restart} data-tip="The new version is installed. Restart to use it.">Restart to finish updating</button>}
        {upd && !ready && <button className="cta" disabled={!!busy} onClick={apply}>{busy === "u" ? "Updating…" : "Update available"}</button>}
        <MoreMenu open={menu} setOpen={setMenu} prefs={prefs} setPrefs={setPrefs} refresh={refresh} setRefresh={setRefresh} alertPrefs={alertPrefs} setAlertPrefs={setAlertPrefs}
          auto={auto} setAuto={setAuto} upd={upd} fail={fail} busy={busy} ready={ready} ver={ver} look={look} calmFold={calmFold} setCalmFold={setCalmFold} snoozeUntil={snoozeUntil} setSnoozeUntil={setSnoozeUntil} quiet={quiet} setQuiet={setQuiet} muted={muted} onMute={onMute} onLimits={() => setLimDlg(true)} onCheck={checkNow}
          onMachines={() => setDlg(true)} onHelp={() => setHelp(true)} onMini={toggleMini} onRestart={() => act("r", () => api.restartCollector())}
          onStop={() => window.confirm("Stop everything? The monitor and its collector will close until you open it again.") && act("s", () => api.stopEverything())} />
      </div>
      </div>
      {pal && <Palette items={cmds} onClose={() => setPal(false)} />}
      {limDlg && <Limits names={ms.map(m => m.name)} limits={limits} onSave={v => { setLimits(tidyLimits(v)); setLimDlg(false); }} onClose={() => setLimDlg(false)} />}
      {dlg && <Machines onClose={() => setDlg(false)} />}
      {help && <div className="modal" onClick={() => setHelp(false)}><div className="dlg" onClick={e => e.stopPropagation()}><h3>Keyboard shortcuts</h3>{KEYS.map(([k, t]) => <div className="mrow" key={k}><kbd>{k}</kbd><span>{t}</span></div>)}<div className="mfoot"><button className="cta" onClick={() => setHelp(false)}>Close</button></div></div></div>}
    </div>
  );
}
