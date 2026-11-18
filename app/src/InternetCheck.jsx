import { useEffect, useState } from "react";
import * as api from "./api.js";
import { load, save } from "./store.js";
import { DEFAULT_HOST, hostOk, internetNow, msText, stripCells, uptimeText } from "./network.js";
// "Is the internet working?": a DNS lookup and an HTTPS HEAD request every minute from This PC, with the last 24 hours as a strip.
const HOST_KEY = "internetHost";
const hhmm = t => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
// The last 24 h of the check, asked for once a minute.
function useDay(machine) {
  const [pts, setPts] = useState([]);
  useEffect(() => {
    let live = true;
    const go = () => api.getHistory(machine, 86400).then(h => live && setPts(h?.extra?.inet || [])).catch(() => {});
    go(); const id = setInterval(go, 60000); return () => { live = false; clearInterval(id); };
  }, [machine]);
  return pts;
}
export default function InternetCheck({ m, d, now }) {
  const [host, setHost] = useState(() => load(HOST_KEY, DEFAULT_HOST)), [draft, setDraft] = useState(host), pts = useDay(m.name), cur = internetNow(d), cells = stripCells(pts, now);
  useEffect(() => { api.setInternetHost(host).catch(() => {}); }, [host]);   // the collector starts with the default; tell it the saved choice
  const apply = e => { e.preventDefault(); const v = draft.trim() || DEFAULT_HOST; if (hostOk(v)) { setHost(v); save(HOST_KEY, v); } };
  return (
    <div className="inet">
      <div className="inet-now">
        <span className={"adot" + (cur ? (cur.up ? " up" : " down") : "")} aria-hidden="true" />
        <b>{cur ? (cur.up ? "Internet is up" : "Internet is down") : "Checking…"}</b>
        {cur?.up && <span>{msText(cur.ms)} · lookup {msText(cur.dns)}</span>}
        {uptimeText(cells) && <em>{uptimeText(cells)} up in the last 24 hours</em>}
      </div>
      <div className="strip24" role="img" aria-label="Internet up or down over the last 24 hours">{cells.map(c => <i key={c.t} className={c.state} data-tip={`${hhmm(c.t)}: ${{ none: "no data", up: "up", part: "some checks failed", down: "down" }[c.state]}`} />)}</div>
      <form className="inet-host" onSubmit={apply}>
        <label>Checks <input value={draft} onChange={e => setDraft(e.target.value)} aria-label="Address to check" spellCheck={false} /></label>
        <button type="submit" disabled={!hostOk(draft.trim() || DEFAULT_HOST) || draft.trim() === host}>Use this</button>
      </form>
    </div>);
}
