import { isWarn, WATCH } from "./format.js";
import { badNow } from "./alerts.js";
const HOUR = 3600;
// Where each machine was last seen and since when its CPU has been over the limit. Pure: gives back the new maps and never changes `prev`,
// so it can run in render (twice in StrictMode) and still agree. An entry that did not change keeps its identity, so cards can skip re-rendering.
// prev: { hot: { name: { cpu } }, lastOk: { name: seconds } }; nowMs in ms; limitsOf(name) gives that machine's limits.
export function trackMachines(prev, ms, nowMs, limitsOf) {
  const hot = {}, lastOk = { ...prev.lastOk };
  for (const m of ms) {
    let cpu = 0;
    if (!m.err) {
      lastOk[m.name] = m.t || nowMs / 1000;
      if (isWarn("cpu", m.d?.cpu, limitsOf(m.name))) cpu = prev.hot[m.name]?.cpu || (m.t ? m.t * 1000 : nowMs);   // keep the first time it went over
    }
    const old = prev.hot[m.name];
    hot[m.name] = old && old.cpu === cpu ? old : { cpu };
  }
  return { hot, lastOk };
}
// Nothing wrong: online, CPU not hot, no watched number over its limit, no failing container or service, no failed job in the last hour.
// `hot` is the machine's { cpu } start time, rows are [machine, runner, start, end, result, label], `now` is in seconds.
export const isCalm = (m, hot, rows, now, limits) => !m.err && !hot?.cpu && !WATCH.some(k => isWarn(k, m.d?.[k], limits)) && badNow(m.d).length === 0
  && !(rows || []).some(r => r[0] === m.name && r[4] === "Failed" && r[3] >= now - HOUR);
