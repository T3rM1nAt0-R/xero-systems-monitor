import HwStrip from "../HwStrip.jsx";
import Sub from "../Sub.jsx";
import { gb, avg, peak, isWarn } from "../format.js";
// The CPU section: CPU, CPU temperature and memory graphs, the extra hardware numbers, and the busiest programs.
export const stat = (a, f) => a.length ? `usual ${f(avg(a))} · peak ${f(peak(a))}` : "";
export default function Cpu({ m, d, P, Pn, limits, marks }) {
  return (
    <>
      <div className="dgrid">
        <Pn title="CPU" k="cpu" busy val={d.cpu?.toFixed(0)} vu="%" warn={isWarn("cpu", d.cpu, limits)} sm={stat(P("cpu"), v => v.toFixed(0) + "%")} max={100} unit="%" thr={limits.cpu} thrLabel={`High above ${limits.cpu}%`} mk={marks} />
        <Pn title="CPU temp" k="temp" val={d.temp?.toFixed(0)} vu="°C" warn={isWarn("temp", d.temp, limits)} max={100} unit="°C" thr={limits.temp} thrLabel={`Warm above ${limits.temp}°C`} />
        <Pn title="Memory" k="ram" busy val={d.ram_gb ? gb(d.ram_gb[0]) : d.ram?.toFixed(0)} vu={d.ram_gb ? `/ ${d.ram_gb[1].toFixed(0)} GB` : "%"} warn={isWarn("ram", d.ram)} max={100} unit="%" />
      </div>
      <HwStrip d={d} />
      {d.top?.length > 0 && <div className="procs"><Sub id={m.name + ".procs"} title="Busiest programs now">{d.top.slice(0, 5).map(([n, c, r, k]) => <div className="prow" key={n}><b data-tip={n.replace(/_/g, " ")}>{n.replace(/_/g, " ")}{k > 1 ? ` ×${k}` : ""}</b><span className="meter"><i style={{ width: Math.min(100, c * 2) + "%" }} /></span><span>{c.toFixed(c < 10 ? 1 : 0)}%</span><span>{r >= 1024 ? (r / 1024).toFixed(1) + " GB" : Math.round(r) + " MB"}</span></div>)}</Sub></div>}
    </>);
}
