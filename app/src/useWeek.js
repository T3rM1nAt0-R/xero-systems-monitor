import { useEffect, useState } from "react";
import * as api from "./api.js";
// What one machine's card needs beyond the graphs on screen: the last 7 days of readings (for "unusual for this time" and the outage strip)
// and the last 7 days of Activity events (for the graph markers and the outage strip). Fetched when the card opens, then every few minutes.
export const WEEK = 604800, REFRESH_MS = 300000, EVENTS_MAX = 400;
export default function useWeek(name, on = true) {
  const [week, setWeek] = useState(null), [events, setEvents] = useState([]);
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    const go = () => {
      if (document.hidden) return;
      api.getHistory(name, WEEK).then(h => live && h && setWeek(h)).catch(() => {});
      api.getEvents(Math.floor(Date.now() / 1000 - WEEK), EVENTS_MAX).then(e => live && Array.isArray(e) && setEvents(e)).catch(() => {});
    };
    go(); const id = setInterval(go, REFRESH_MS);
    return () => { live = false; clearInterval(id); };
  }, [name, on]);
  return { week, events };
}
