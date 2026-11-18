import Sub from "./Sub.jsx";
import { gpuAppRows, vramText } from "./hwStrip.js";
// Which programs are using the graphics card, and how much of its memory each holds (NVIDIA cards).
export default function GpuApps({ m, d }) {
  const rows = gpuAppRows(d.gpuapps);
  return (
    <Sub id={m.name + ".gpuapps"} title="Programs using the graphics card" hint={rows.length ? `${rows.length} running` : ""}>
      {rows.length === 0 ? <p className="quiet">Nothing is using the graphics card right now.</p> : (
        <div className="procs">{rows.map(r => (
          <div className="prow gpurow" key={r.name}>
            <b data-tip={r.name}>{r.name}{r.count > 1 ? ` ×${r.count}` : ""}</b>
            <span className="meter"><i style={{ width: r.share + "%", background: "var(--c-gpu)" }} /></span>
            <span>{vramText(r.mb)}</span>
          </div>))}</div>)}
    </Sub>);
}
