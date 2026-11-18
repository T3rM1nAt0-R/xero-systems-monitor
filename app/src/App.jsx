import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card.jsx";
import Compact from "./Compact.jsx";
import ActivityDrawer from "./ActivityDrawer.jsx";
import Machines from "./Machines.jsx";
import Strip from "./Strip.jsx";
import Palette from "./Palette.jsx";
import ViewControl from "./ViewControl.jsx";
import HiddenMachines from "./HiddenMachines.jsx";
import { showStrip, fitsWindow, visibleMachines, hideName, showName } from "./view.js";
import { buildCommands } from "./commands.js";
import { applyOrder, moveTo, stripOrder, groupsFor } from "./order.js";
import { loadGroups, saveGroups, revealGroup } from "./groupPrefs.js";
import useCardDrag from "./cardDrag.js";
import MoreMenu, { REFRESH } from "./MoreMenu.jsx";
import { Clock, Ago } from "./Clock.jsx";
import * as api from "./api.js";
import { hm } from "./format.js";
import { memoLimitsFor, tidyLimits } from "./limits.js";
import { DEFAULT_QUIET, mute, unmute } from "./quiet.js";
import Limits from "./Limits.jsx";
import { DEFAULT_PREFS } from "./alerts.js";
import { unseenFailures } from "./events.js";
import { RANGES, snapRange, SHORT, KEYS, NONE, NO_HOT } from "./consts.js";
import { trackMachines } from "./calm.js";
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
  const appRef = useRef(null), seen = useRef({ hot: {}, lastOk: {} });
  useEffect(() => save("alerts", alertPrefs), [alertPrefs]);
  const [limits, setLimits] = usePersisted("limits", {}), [quiet, setQuiet] = usePersisted("quiet", DEFAULT_QUIET), [muted, setMuted] = usePersisted("muted", []);

  const [localName, setLocalName] = useState("");   // which machine is this PC (the strip lists it first)
  useEffect(() => { if (!dlg) api.getMachines().then(c => setLocalName(c?.machines?.find(m => m.kind === "local")?.name || ""), () => {}); }, [dlg]);
  const [order, setOrder] = usePersisted("order", []);   // the card order you chose by dragging
  const all = useMemo(() => state?.machines || [], [state]), ms = useMemo(() => applyOrder(all, order), [all, order]);
  const [hidden, setHidden] = usePersisted("hidden", () => []), [stripMode, setStripMode] = usePersisted("stripShow", "auto"), [hidDlg, setHidDlg] = useState(false), [fits, setFits] = useState(false);
  const vms = useMemo(() => visibleMachines(ms, hidden), [ms, hidden]);   // hidden machines leave the strip, the cards, the compact view and the tray summary
  const hideMachine = useCallback(n => setHidden(h => hideName(h, n)), [setHidden]), showMachine = useCallback(n => setHidden(h => showName(h, n)), [setHidden]);
  const limitsOf = useMemo(() => memoLimitsFor(limits), [limits]);   // one call style for limits everywhere: limitsOf(name), the same object until the saved limits change
  const { hot, lastOk } = useMemo(() => trackMachines(seen.current, ms, now, limitsOf), [ms, now, limitsOf]);   // pure: remembers when each machine was last seen and since when its CPU has been over its limit
  useEffect(() => { seen.current = { hot, lastOk }; }, [hot, lastOk]);
  const [snoozeUntil, setSnoozeUntil] = usePersisted("snooze", 0), [fired, setFired] = usePersisted("fired", []);
  const onFire = useCallback(f => setFired(l => [f, ...l].slice(0, 100)), [setFired]);
  useAlerts(ms, hot, rows, alertPrefs, { fc, events, snoozeUntil, onFire, limitsOf, quiet, muted });
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

  useEffect(() => {   // "Auto" strip: measure everything but the strip; when it all fits the window, the strip is not needed
    const fit = () => { const el = appRef.current; if (!el) return; let h = 0; for (const c of el.children) if (!c.classList.contains("stripwrap") && !c.classList.contains("modal") && !c.classList.contains("dock")) h += c.offsetHeight; setFits(fitsWindow(h + (el.querySelector(".dock")?.offsetHeight || 0), window.innerHeight)); };
    fit(); const id = setInterval(fit, 1500); window.addEventListener("resize", fit); return () => { clearInterval(id); window.removeEventListener("resize", fit); };
  }, [vms, expanded, effCompact, folded]);
  const stripOn = !effCompact && showStrip(stripMode, vms.length, fits);

  const goMachine = useCallback(n => { if (effRef.current) setExpanded(s => new Set(s).add(n)); open(n); }, [open]);
  const goGroup = useCallback((n, k) => {
    const g = loadGroups(n); if (g.hidden.includes(k)) saveGroups(n, { ...g, hidden: g.hidden.filter(x => x !== k) });   // asking for a hidden group shows it again
    goMachine(n); setTimeout(() => revealGroup(n + "." + k), 120);
  }, [goMachine]);
  const dragProps = useCardDrag((from, to) => setOrder(o => moveTo(applyOrder(all, o).map(m => m.name), from, to)));
  const cmds = useMemo(() => buildCommands({ machines: vms, hiddenNames: hidden, showMachine, groupsOf: m => groupsFor(m.d, hist[m.name]), goMachine, goGroup, ranges: RANGES, setRange, look, refreshOptions: REFRESH, setRefresh, pin, setPin, compact, setCompact, toggleMini, alertPrefs, setAlert: (k, on) => setAlertPrefs(p => ({ ...p, [k]: on })), onLimits: () => setLimDlg(true), quietOn: !!quiet.on, setQuietOn: on => setQuiet(q => ({ ...DEFAULT_QUIET, ...q, on })), snooze1h: () => setSnoozeUntil(Date.now() + 3600000), onMachines: () => setDlg(true), onCheck: checkNow, foldAll: fold => foldMachines(!fold) }), [vms, hidden, showMachine, hist, foldMachines, goMachine, goGroup, look, pin, compact, alertPrefs, quiet.on, checkNow, setRange, setRefresh, setPin, setCompact, toggleMini, setQuiet, setSnoozeUntil]);
  const unseen = useMemo(() => unseenFailures(events, evSeen), [events, evSeen]);
  useTrayStatus(vms, limitsOf, unseen);
  const markSeen = () => { const x = Date.now() / 1000; setEvSeen(x); save("evseen", x); };
  const openEv = () => { setShowEv(true); markSeen(); }, closeEv = () => { setShowEv(false); markSeen(); };
  useShortcuts({ dlg, setDlg, help, setHelp, menu, setMenu, showEv, closeEv, openEv, ms: vms, open, ranges: RANGES, range: safeRange, setRange, setCompact, toggleMini, setPin, setPal, foldMachines });

  const card = m => <Card key={m.name} m={m} h={hist[m.name]} h2={hist2[m.name]} rows={rows} fc={fc[m.name]} range={safeRange} now={now / 1000} lastOk={m.err ? lastOk[m.name] : undefined} hot={hot[m.name] || NO_HOT} limits={limitsOf(m.name)} auto={calmFold} flat={effCompact} gone={m.gone || NONE} onOpen={open} onTry={retry} onHide={hideMachine} />;   // `open` toggles the row in compact view and scrolls to the card otherwise
  return (
    <div className={"app" + (err && state ? " stale" : "")} ref={appRef} onClick={() => menu && setMenu(false)}>
      <div className="bar top">
        {!effCompact && <span className="brand"><b>XERO</b> SYSTEMS MONITOR</span>}
        <span className="live"><i className={"dot" + (err ? " off" : "")} /><Ago err={err} stamp={stamp} short={effCompact} /></span>
        <span className="grow" />
        {!effCompact && <span className="live hide-s clock"><Clock /></span>}
        {!mini && <ViewControl compact={compact} mini={mini} setCompact={setCompact} setMini={on => on !== mini && toggleMini()} pin={pin} setPin={setPin} folded={folded} foldMachines={foldMachines} stripMode={stripMode} setStripMode={setStripMode} hiddenCount={hidden.length} onHidden={() => setHidDlg(true)} />}
        {mini && <button className="on" onClick={toggleMini} data-tip="Back to the normal window (M)">Expand</button>}
      </div>

      {err && state && <div className="stalebar" role="status"><b>Collector not answering since {hm(stamp / 1000)}.</b> Showing the last numbers it sent; they are not live. Retrying every few seconds.<button onClick={retry}>Try now</button></div>}
      {!state && <div className="empty">{err ? <>Waiting for the collector…<small>{err}</small></> : "Loading…"}</div>}


      {state && !effCompact && <div className={"stripwrap" + (stripOn ? " open" : "")} aria-hidden={!stripOn}><div><Strip ms={stripOrder(vms, localName)} hist={hist} lastOk={lastOk} onHide={hideMachine} onOpen={n => { foldAll(true, CARD + n, true); goMachine(n); }} /></div></div>}
      {state && !!ms.length && !vms.length && <div className="empty">All machines are hidden.<small><button onClick={() => setHidDlg(true)}>Hidden machines…</button></small></div>}
      {state && effCompact && <Compact limitsOf={limitsOf} ms={vms} now={now} lastOk={lastOk} hot={hot} expanded={expanded} onToggle={toggleOpen} renderCard={card} />}
      {state && !effCompact && <main className="grid" onPointerDown={dragProps}>{vms.map(card)}</main>}

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
      {hidDlg && <HiddenMachines hidden={hidden} onShow={showMachine} onClose={() => setHidDlg(false)} />}
      {dlg && <Machines onClose={() => setDlg(false)} />}
      {help && <div className="modal" onClick={() => setHelp(false)}><div className="dlg" onClick={e => e.stopPropagation()}><h3>Keyboard shortcuts</h3>{KEYS.map(([k, t]) => <div className="mrow" key={k}><kbd>{k}</kbd><span>{t}</span></div>)}<div className="mfoot"><button className="cta" onClick={() => setHelp(false)}>Close</button></div></div></div>}
    </div>
  );
}
