import N from "./Pill.jsx";
import Spark from "./Spark.jsx";
import { isWarn } from "./format.js";
import { badNow } from "./alerts.js";
// What a folded machine card still shows: the top-level numbers, and a tiny CPU line.
export default function CardBar({ d, h, off, bad, limits }) {
  if (off) return null;
  const total = Object.keys(d.runners || {}).length, failing = badNow(d).length;
  return (
    <span className="cnums bar">
      <N label="CPU" v={d.cpu} u="%" warn={isWarn("cpu", d.cpu, limits)} /><N v={d.temp} u="°" warn={isWarn("temp", d.temp, limits)} /><N label="Mem" v={d.ram} u="%" warn={isWarn("ram", d.ram, limits)} />
      {d.gpu != null && <N label="GPU" v={d.gpu} u="%" />}{d.disk != null && <N label="Disk" v={d.disk} u="%" />}
      {total > 0 && <span className="cn"><small>Runners</small>{Object.keys(d.jobs || {}).length}/{total} busy</span>}
      {failing > 0 && <span className="cn warn">{failing} failing</span>}
      <Spark pts={h?.cpu} color={bad ? "var(--warn)" : "#4ade80"} />
    </span>);
}
