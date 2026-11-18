import { hm } from "./format.js";
import { tint, useMachineColors } from "./theme/tint.js";
import MachineMenu from "./MachineMenu.jsx";
import { tileModel } from "./strip.js";
import StatusDot from "./StatusDot.jsx";
import TileSpark from "./TileSpark.jsx";
const SPARK_W = 40, SPARK_H = 14, SPARK_N = 60;   // the little CPU line: size, and how many of the latest points it shows
const N = ({ label, v, u = "%" }) => v == null ? null : <span><small>{label}</small>{v}{u}</span>;
// The machines strip: one small tile per machine (This PC first). Click a tile to jump to that machine's card.
export default function Strip({ ms, hist, lastOk, onOpen, onHide }) {
  const colors = useMachineColors(ms);
  return (
    <nav className="strip" aria-label="Machines">
      {ms.map(m => { const t = tileModel(m, lastOk[m.name], hm), pts = (hist[m.name]?.cpu || []).slice(-SPARK_N);
        return (
          <div className="tilewrap" key={m.name}>
          <button style={tint(colors[m.name])} className={"tile" + (t.off ? " off" : "")} onClick={() => onOpen(m.name)} data-tip={t.off ? `${m.name} is offline` : `Go to ${m.name}`}>
            <span className="th"><StatusDot off={t.off} /><b>{m.name}</b></span>
            <span className="tl2">
              {t.off ? <span className="tn seen">{t.seen}</span>
                : <span className="tn"><N label="CPU " v={t.cpu} /><N label="Mem " v={t.mem} /><N label="GPU " v={t.gpu} /><N label="" v={t.temp} u="°C" /></span>}
              {!t.off && <TileSpark pts={pts} w={SPARK_W} h={SPARK_H} />}
            </span>
          </button>
          <MachineMenu name={m.name} onHide={onHide} />
          </div>); })}
    </nav>);
}
