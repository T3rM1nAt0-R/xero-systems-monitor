import { useCallback, useEffect, useState } from "react";
import * as api from "./api.js";
// Asks for one answer per machine (names are joined with "|"); a machine that fails is skipped. Gives [[name, answer], ...].
const perMachine = async (names, ask) => (await Promise.all(names.split("|").map(n => ask(n).then(a => [n, a], () => null)))).filter(Boolean);
// Everything the window reads from the collector: the live state, graph history, the activity list, finished jobs and the disk forecast.
// Each piece refreshes on its own timer and pauses while the window is hidden.
export default function useCollectorData(range, refresh) {
  const [state, setState] = useState(null), [err, setErr] = useState(null), [stamp, setStamp] = useState(0), [now, setNow] = useState(Date.now());
  const [hist, setHist] = useState({}), [events, setEvents] = useState([]), [rows, setRows] = useState([]), [fc, setFc] = useState({}), [tick, setTick] = useState(0);
  const poll = useCallback(async () => {
    if (document.hidden) return;
    try { const s = await api.getState(); setState(s); setErr(null); setStamp(Date.now()); setNow(Date.now()); } catch (e) { setErr(String(e.message || e)); }
  }, []);
  useEffect(() => { poll(); const id = setInterval(poll, refresh * 1000); const f = () => !document.hidden && poll(); document.addEventListener("visibilitychange", f); return () => { clearInterval(id); document.removeEventListener("visibilitychange", f); }; }, [poll, refresh]);

  const names = (state?.machines || []).map(m => m.name).join("|");
  useEffect(() => {   // graph history for the chosen range; the old graph stays until the new one arrives
    if (!names) return; let live = true;
    const go = async () => { if (document.hidden) return; const got = await perMachine(names, n => api.getHistory(n, range)); if (live) setHist(p => ({ ...p, ...Object.fromEntries(got) })); };
    go(); const id = setInterval(go, range >= 604800 ? 300000 : range >= 3600 ? 60000 : 10000); return () => { live = false; clearInterval(id); };
  }, [names, range, tick]);
  useEffect(() => {   // the Activity list: what happened in the last day
    let live = true;
    const go = () => { if (!document.hidden) api.getEvents(Math.floor(Date.now() / 1000 - 86400), 60).then(e => live && Array.isArray(e) && setEvents(e)).catch(() => {}); };
    go(); const id = setInterval(go, 15000); return () => { live = false; clearInterval(id); };
  }, []);
  useEffect(() => {   // finished jobs: the timeline, the 24 h summary, busy per day and failure alerts all read these rows
    let live = true;
    const go = () => { if (!document.hidden) api.getJobs(Math.floor(Date.now() / 1000 - Math.max(range, 14 * 86400))).then(r => live && Array.isArray(r) && setRows(r)).catch(() => {}); };
    go(); const id = setInterval(go, 20000); return () => { live = false; clearInterval(id); };
  }, [range]);
  useEffect(() => {   // disk-full forecast: changes slowly, so once in a while
    if (!names) return; let live = true;
    const go = async () => { const got = await perMachine(names, api.getForecast); if (live) setFc(Object.fromEntries(got)); };
    go(); const id = setInterval(go, 600000); return () => { live = false; clearInterval(id); };
  }, [names]);
  const retry = useCallback(() => { poll(); setTick(x => x + 1); }, [poll]);
  return { state, err, stamp, now, hist, events, rows, fc, retry };
}
