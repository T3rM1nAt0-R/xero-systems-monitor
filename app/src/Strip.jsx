import { hm } from "./format.js";
import { tileModel, sparkPoints } from "./strip.js";
const SPARK_W = 40, SPARK_H = 14, SPARK_N = 60;   // the little CPU line: size, and how many of the latest points it shows
const N = ({ label, v, u = "%" }) => v == null ? null : <span><small>{label}</small>{v}{u}</span>;
// The machines strip: one small tile per machine (This PC first). Click a tile to jump to that machine's card.
export default function Strip({ ms, hist, lastOk, onOpen }) {
  return (
    <nav className="strip" aria-label="Machines">
      {ms.map(m => { const t = tileModel(m, lastOk[m.name], hm), pts = sparkPoints((hist[m.name]?.cpu || []).slice(-SPARK_N), SPARK_W, SPARK_H);
        return (
          <button key={m.name} className={"tile" + (t.off ? " off" : "")} onClick={() => onOpen(m.name)} data-tip={t.off ? `${m.name} is offline` : `Go to ${m.name}`}>
            <span className="th"><i className={"dot" + (t.off ? " off" : "")} /><b>{m.name}</b></span>
            <span className="tl2">
              {t.off ? <span className="tn seen">{t.seen}</span>
                : <span className="tn"><N label="CPU " v={t.cpu} /><N label="Mem " v={t.mem} /><N label="GPU " v={t.gpu} /><N label="" v={t.temp} u="°C" /></span>}
              {!t.off && pts && <svg className="tspark" width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>}
            </span>
          </button>); })}
    </nav>);
}
