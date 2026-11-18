import { batteryFacts } from "../hwStrip.js";
// The battery section: charge as a big number and a bar, whether it is charging, and the time left (only where the machine says).
export default function Battery({ d }) {
  const b = batteryFacts(d.bat);
  if (!b) return null;
  return (
    <div className="battery">
      <div className="batnum"><b>{b.text}</b><span>{b.state}{b.left ? ` · ${b.left}` : ""}</span></div>
      <span className={"meter " + b.level} role="img" aria-label={`Battery ${b.text}, ${b.state}`}><i style={{ width: Math.min(100, b.pct) + "%" }} /></span>
    </div>);
}
