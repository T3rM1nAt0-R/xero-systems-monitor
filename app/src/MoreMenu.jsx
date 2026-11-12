import { useState } from "react";
import { since } from "./format.js";
import { ALERTS } from "./alerts.js";
import { notify } from "./useAlerts.js";
import * as api from "./api.js";
export const REFRESH = [3, 5, 10, 30, 60];   // seconds; the collector itself samples every 3 s

// One menu row. `on` (true/false) makes it a switch; `hint` is the small text on the right (a shortcut or a status).
const Row = ({ on, hint, danger, onClick, disabled, children }) => (
  <button role={on == null ? "menuitem" : "menuitemcheckbox"} aria-checked={on == null ? undefined : on} className={"mrow2" + (danger ? " danger" : "")} disabled={disabled} onClick={onClick}>
    <span className="mtxt">{children}</span>
    {on != null ? <i className={"sw" + (on ? " on" : "")} /> : hint && <em>{hint}</em>}
  </button>);
const Head = ({ children }) => <div className="mlabel">{children}</div>;

// The More menu, in groups: Monitor, Alerts, Window, Updates, then Help and Stop.
export default function MoreMenu({ open, setOpen, prefs, setPrefs, refresh, setRefresh, alertPrefs, setAlertPrefs, auto, setAuto, upd, fail, busy, ready, ver, look, snoozeUntil, setSnoozeUntil, onCheck, onMachines, onHelp, onMini, onRestart, onStop }) {
  const [alerts, setAlerts] = useState(false);
  const close = fn => () => { setOpen(false); fn(); };
  const onCount = ALERTS.filter(([k]) => alertPrefs[k]).length;
  const upText = busy === "c" ? "Checking…" : busy === "u" ? "Updating…" : fail === "dirty" ? "Blocked by local edits" : fail ? "Failed, see update.log" : upd === false ? "Up to date ✓" : upd ? "Update ready" : "Check now";
  return (
    <div className="menuwrap">
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>More ⋯</button>
      {open && <div className="menu" role="menu">
        <Head>Monitor</Head>
        <Row onClick={close(onMachines)}>Machines…</Row>
        <div className="mseg" role="group" aria-label="Refresh every"><span>Refresh</span>
          <div className="seg">{REFRESH.map(r => <button key={r} className={refresh === r ? "on" : ""} onClick={() => setRefresh(r)}>{r < 60 ? r + "s" : "1m"}</button>)}</div></div>

        <hr /><Row hint={`${onCount} of ${ALERTS.length} on  ${alerts ? "▾" : "▸"}`} onClick={() => setAlerts(a => !a)}>Notify me when…</Row>
        {alerts && <div className="msub">
          {ALERTS.map(([k, label]) => <Row key={k} on={!!alertPrefs[k]} onClick={() => setAlertPrefs(p => ({ ...p, [k]: !p[k] }))}>{label}</Row>)}
          <div className="mseg" role="group" aria-label="Snooze alerts"><span>{snoozeUntil > Date.now() ? `Snoozed until ${new Date(snoozeUntil).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Snooze"}</span>
            <div className="seg"><button className={snoozeUntil > Date.now() && snoozeUntil - Date.now() <= 3600000 ? "on" : ""} onClick={() => setSnoozeUntil(Date.now() + 3600000)}>1 h</button>
              <button className={snoozeUntil - Date.now() > 3600000 ? "on" : ""} onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); setSnoozeUntil(+d); }}>Till 8 AM</button>
              <button disabled={!(snoozeUntil > Date.now())} onClick={() => setSnoozeUntil(0)}>Off</button></div></div>
          <Row onClick={close(() => notify({ key: "test" + Date.now(), title: "Xero Systems Monitor", body: "Notifications work." }))}>Send a test notification</Row>
        </div>}

        <hr /><Head>Look</Head>
        <div className="mseg" role="group" aria-label="Theme"><span>Theme</span><div className="seg">{[["dark", "Dark"], ["light", "Light"], ["system", "Windows"]].map(([k, l]) => <button key={k} className={look.theme === k ? "on" : ""} onClick={() => look.setTheme(k)}>{l}</button>)}</div></div>
        <div className="mseg" role="group" aria-label="Text size"><span>Text</span><div className="seg">{[["normal", "Normal"], ["large", "Large"]].map(([k, l]) => <button key={k} className={look.size === k ? "on" : ""} onClick={() => look.setSize(k)}>{l}</button>)}</div></div>
        {prefs && <><hr /><Head>Window</Head>
          <Row on={prefs.closeToTray} onClick={() => api.setPrefs({ closeToTray: !prefs.closeToTray }).then(setPrefs)}>Close button hides to the tray</Row>
          <Row on={prefs.login} onClick={() => api.setPrefs({ login: !prefs.login }).then(setPrefs)}>Start with Windows, hidden</Row></>}
        <Row hint="M" onClick={close(onMini)}>Mini corner view</Row>

        {!prefs?.packaged && <><hr /><Head>Updates</Head>
          <Row hint={upText} disabled={!!busy} onClick={onCheck}>Check for updates</Row>
          <Row on={auto} onClick={() => setAuto(!auto)}>Update by itself</Row></>}

        <hr />
        <Row hint="?" onClick={close(onHelp)}>Keyboard shortcuts</Row>
        <Row disabled={!!busy} onClick={close(onRestart)}>{busy === "r" ? "Reconnecting…" : "Restart the collector"}</Row>
        <div className="mgap" />
        <Row danger onClick={close(onStop)}>Stop everything…</Row>
        {ver && <div className="mver" data-tip={ver.date ? new Date(ver.date * 1000).toLocaleString("en-US") : ""}>Version {ver.version}{ver.date ? ` · updated ${since(ver.date)} ago` : ""}{ready ? " · restart to finish" : ""}</div>}
      </div>}
    </div>);
}
