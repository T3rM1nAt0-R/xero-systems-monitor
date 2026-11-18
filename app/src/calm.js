import { isWarn, WATCH } from "./format.js";
import { badNow } from "./alerts.js";
const HOUR = 3600;
// Nothing wrong: online, CPU not hot, no watched number over its limit, no failing container or service, no failed job in the last hour.
// `hot` is the machine's { cpu } start time, rows are [machine, runner, start, end, result, label], `now` is in seconds.
export const isCalm = (m, hot, rows, now, limits) => !m.err && !hot?.cpu && !WATCH.some(k => isWarn(k, m.d?.[k], limits)) && badNow(m.d).length === 0
  && !(rows || []).some(r => r[0] === m.name && r[4] === "Failed" && r[3] >= now - HOUR);
