import Sub from "../Sub.jsx";
import { gb } from "../format.js";
// The Disk section: one disk-use graph with the "full in ..." forecast, and the drives list under it.
export default function Disk({ m, d, Pn, limits, fc, full }) {
  const drives = d.storage || [], sum = drives.reduce((a, x) => [a[0] + x[1], a[1] + x[2]], [0, 0]);
  return (
    <Pn title="Disk use" k="disk" cls="diskcard" val={d.disk?.toFixed(0)} vu="%" sm={drives.length > 0 ? `${gb(sum[0])} of ${sum[1].toFixed(0)} GB used` : ""} fcText={full} fcWarn={!!fc?.days && fc.days <= limits.days} fcTip={fc ? `A straight line through the last 30 days: +${fc.per_day}% of the disk per day` : undefined} max={100} unit="%">
      <Sub id={m.name + ".drives"} title="Drives" hint={drives.length > 0 && `${drives.length} ${drives.length === 1 ? "drive" : "drives"}`}><div className="drives">
        {drives.length ? drives.map(([n, u, t]) => <div className="drive" key={n}><span data-tip={n}>{n}</span><span className={"meter" + (100 * u / t > limits.disk ? " crit" : 100 * u / t > limits.disk - 15 ? " warn" : "")}><i style={{ width: Math.min(100, 100 * u / t) + "%" }} /></span><em>{gb(u)} / {t.toFixed(0)} GB</em></div>) : <div className="quiet">No drive information yet.</div>}
      </div></Sub>
    </Pn>);
}
