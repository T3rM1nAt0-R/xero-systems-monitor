import { useEffect, useRef } from "react";
import { machineAlerts, failedAlerts, diskAlerts, eventAlerts } from "./alerts.js";
import { isHeld, isMuted } from "./quiet.js";

// Desktop pop-ups for what alerts.js finds. A pop-up shows only when the window is hidden or not focused (nobody needs one for what they are looking at)
// and the alerts are not snoozed. Quiet hours hold every pop-up except "offline"; muted alerts do nothing at all. Every alert that fires is also handed to `onFire`, so the Activity drawer can list what fired and when.
export function notify(a) {
  try { new Notification(a.title, { body: a.body, tag: a.key, silent: false }); } catch { /* a blocked pop-up is not worth an error */ }
}
export default function useAlerts(machines, hot, rows, prefs, { fc, events, snoozeUntil, onFire, limitsOf, quiet, muted }) {
  const prev = useRef(null), after = useRef(null), evAfter = useRef(null), sent = useRef(new Set()), p = useRef(prefs), z = useRef(snoozeUntil), cb = useRef(onFire), lim = useRef(limitsOf), q = useRef(quiet), mu = useRef(muted);
  p.current = prefs; z.current = snoozeUntil; cb.current = onFire; lim.current = limitsOf; q.current = quiet; mu.current = muted;
  const fire = alerts => {
    for (const a of alerts) {
      if (!p.current[a.kind] || sent.current.has(a.key)) continue;
      sent.current.add(a.key);
      if (isMuted(mu.current, a.machine, a.kind)) continue;
      const snoozed = z.current > Date.now(), quietNow = isHeld(q.current, a.kind);
      cb.current?.({ t: Date.now() / 1000, title: a.title, body: a.body, kind: a.kind, machine: a.machine, snoozed, quiet: quietNow });
      if (snoozed || quietNow || (!document.hidden && document.hasFocus())) continue;
      notify(a);
    }
  };
  const hotNow = useRef(hot), machinesNow = useRef(machines); hotNow.current = hot; machinesNow.current = machines;   // read the latest inside effects that run on a narrower trigger
  useEffect(() => { if (!machines.length) return; const r = machineAlerts(prev.current, machines, hotNow.current, Date.now()); prev.current = r.next; fire(r.alerts); }, [machines]);
  useEffect(() => { if (!rows.length && after.current == null) return; const r = failedAlerts(rows, after.current); after.current = r.after; fire(r.alerts); }, [rows]);
  useEffect(() => { if (!machines.length || !fc) return; fire(diskAlerts(machinesNow.current, fc, Date.now(), lim.current)); }, [fc, machines.length]);
  useEffect(() => { if (!events) return; const r = eventAlerts(events, evAfter.current); evAfter.current = r.after; fire(r.alerts); }, [events]);
}
