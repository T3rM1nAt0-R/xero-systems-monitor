import { hwNumbers, coreBars } from "./hwStrip.js";
// A calm row of numbers plus one thin bar per CPU core. Nothing shows when LibreHardwareMonitor is not running.
export default function HwStrip({ d }) {
  const nums = hwNumbers(d), bars = coreBars(d.cores);
  if (!nums.length && !bars.length) return null;
  return (
    <div className="hwstrip">
      {nums.map(([k, v]) => <span key={k}><small>{k}</small> {v}</span>)}
      {bars.length > 0 && <span className="cores" role="img" aria-label={`Load per core: ${d.cores.map(c => c.toFixed(0) + "%").join(", ")}`}>{bars.map((h, i) => <i key={i} className={d.cores[i] >= 90 ? "hot" : ""} style={{ height: h + "%" }} data-tip={`Core ${i + 1}: ${d.cores[i].toFixed(0)}%`} />)}</span>}
    </div>
  );
}
