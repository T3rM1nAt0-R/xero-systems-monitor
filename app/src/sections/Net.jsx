import Conns from "../Conns.jsx";
import { rateStr } from "../format.js";
import { FULL } from "./tabs.js";
// The Network section: download, upload and ping graphs, and (This PC) connections by program. Views: graphs (Overview) or full (Network tab).
export default function Net({ d, h, Pn, view }) {
  return (
    <>
      <div className="dgrid">
        <Pn title="Download" k="down" val={d.down != null ? rateStr(d.down) : null} fmt={rateStr} />
        <Pn title="Upload" k="up" val={d.up != null ? rateStr(d.up) : null} fmt={rateStr} />
        <Pn title="Ping" k="ping" val={d.ping != null ? Number(d.ping).toFixed(0) : null} vu="ms" sm={h?.loss != null ? `${h.loss.toFixed(1)}% lost` : ""} unit=" ms" />
      </div>
      {view === FULL && d.conns?.length > 0 && <Conns list={d.conns} />}
    </>);
}
