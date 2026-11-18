import { gb, isWarn } from "../format.js";
import { stat } from "./Cpu.jsx";
// The GPU section: GPU, GPU temperature and GPU memory graphs.
export default function Gpu({ d, P, Pn, limits }) {
  return (
    <div className="dgrid">
      <Pn title="GPU" k="gpu" val={d.gpu?.toFixed(0)} vu="%" sm={stat(P("gpu"), v => v.toFixed(0) + "%")} max={100} unit="%" />
      <Pn title="GPU temp" k="gtemp" val={d.gtemp?.toFixed(0)} vu="°C" warn={isWarn("gtemp", d.gtemp, limits)} max={100} unit="°C" thr={limits.gtemp} thrLabel={`Warm above ${limits.gtemp}°C`} />
      <Pn title="GPU memory" k="vram" val={d.vram_gb ? gb(d.vram_gb[0]) : d.vram?.toFixed(0)} vu={d.vram_gb ? `/ ${d.vram_gb[1].toFixed(0)} GB` : "%"} max={100} unit="%" />
    </div>);
}
