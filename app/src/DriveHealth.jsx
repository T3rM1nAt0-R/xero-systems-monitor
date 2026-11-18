import { healthNote, healthRows } from "./disks.js";
// Drive health from the drive itself (SMART): OK or warning, temperature, hours powered on, and wear for SSDs. Read about every 10 minutes.
export default function DriveHealth({ d }) {
  const rows = healthRows(d), note = healthNote(d);
  if (!rows.length) return <div className="quiet">{note || "Drive health has not been read yet. It is checked every 10 minutes."}</div>;
  return (
    <div className="health">
      {rows.map(r => (
        <div className={"hrow2" + (r.ok ? "" : " warn")} key={r.name}>
          <span className={"hdot" + (r.ok ? "" : " warn")} aria-hidden="true" /><b data-tip={r.model}>{r.name}</b>
          <span>{r.ok ? "Healthy" : "Needs a look"}</span>
          <em>{r.facts.join(" · ") || r.model}</em>
          {r.wear != null && <span className={"meter" + (r.wear > 80 ? " crit" : r.wear > 50 ? " warn" : "")} data-tip="How much of the SSD's life is used"><i style={{ width: Math.min(100, r.wear) + "%" }} /></span>}
        </div>))}
    </div>);
}
