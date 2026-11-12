import { useEffect, useRef } from "react";
import { machineAlerts, failedAlerts, diskAlerts, eventAlerts } from "./alerts.js";

// Desktop pop-ups for what alerts.js finds. A pop-up shows only when the window is hidden or not focused (nobody needs one for what they are looking at)
// and the alerts are not snoozed. Every alert that fires is also handed to `onFire`, so the Activity drawer can list what fired and when.
export function notify(a) {
  try { new Notification(a.title, { body: a.body, tag: a.key, silent: false }); } catch { /* a blocked pop-up is not worth an error */ }
}
export default function useAlerts(machines, hot, rows, prefs, { fc, events, snoozeUntil, onFire }) {
  const prev = useRef(null), after = useRef(null), evAfter = useRef(null), sent = useRef(new Set()), p = useRef(prefs), z = useRef(snoozeUntil), cb = useRef(onFire);
  p.current = prefs; z.current = snoozeUntil; cb.current = onFire;
  const fire = alerts => {
    for (const a of alerts) {
      if (!p.current[a.kind] || sent.current.has(a.key)) continue;
      sent.current.add(a.key);
      const snoozed = z.current > Date.now();
      cb.current?.({ t: Date.now() / 1000, title: a.title, body: a.body, kind: a.kind, snoozed });
      if (snoozed || (!document.hidden && document.hasFocus())) continue;
      notify(a);
    }
  };
  useEffect(() => { if (!machines.length) return; const r = machineAlerts(prev.current, machines, hot, Date.now()); prev.current = r.next; fire(r.alerts); }, [machines]);
  useEffect(() => { if (!rows.length && after.current == null) return; const r = failedAlerts(rows, after.current); after.current = r.after; fire(r.alerts); }, [rows]);
  useEffect(() => { if (!machines.length || !fc) return; fire(diskAlerts(machines, fc)); }, [fc, machines.length]);
  useEffect(() => { if (!events) return; const r = eventAlerts(events, evAfter.current); evAfter.current = r.after; fire(r.alerts); }, [events]);
}
