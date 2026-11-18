import Conns from "../Conns.jsx";
import Sub from "../Sub.jsx";
import Adapters from "../Adapters.jsx";
import InternetCheck from "../InternetCheck.jsx";
import PingMap from "../PingMap.jsx";
import { rateStr } from "../format.js";
import { FULL } from "./tabs.js";
// The Network section: download, upload and ping graphs. Full view (Network tab) adds adapters and Wi-Fi, and on This PC
// the internet check, the ping map and connections by program. Views: graphs (Overview) or full (Network tab).
export default function Net({ m, d, h, Pn, view, now, t0, t1, span, live }) {
  return (
    <>
      <div className="dgrid">
        <Pn title="Download" k="down" val={d.down != null ? rateStr(d.down) : null} fmt={rateStr} />
        <Pn title="Upload" k="up" val={d.up != null ? rateStr(d.up) : null} fmt={rateStr} />
        <Pn title="Ping" k="ping" val={d.ping != null ? Number(d.ping).toFixed(0) : null} vu="ms" sm={h?.loss != null ? `${h.loss.toFixed(1)}% lost` : ""} unit=" ms" />
      </div>
      {view === FULL && <>
        {(d.adapters?.length > 0 || d.wifi) && <Sub id={m.name + ".adapters"} title="Adapters and Wi-Fi"><Adapters d={d} /></Sub>}
        {d.inet && <Sub id={m.name + ".inet"} title="Internet check"><InternetCheck m={m} d={d} now={now} /></Sub>}
        {d.pings?.length > 0 && <Sub id={m.name + ".pings"} title="Ping map" hint="from this PC"><PingMap m={m} d={d} h={h} t0={t0} t1={t1} span={span} live={live} /></Sub>}
        {d.conns?.length > 0 && <Conns list={d.conns} />}
      </>}
    </>);
}
