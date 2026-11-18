import { COLOR_ITEMS, METRIC_ITEMS, builtIn, contrastWarning, isHex } from "../theme/model.js";
import { useMachineSettings } from "../machineSettings.js";
import { Reset, Row } from "./controls.jsx";
const GREY = "#888888";   // what the picker shows for a colour it cannot show (the colour input only takes #rrggbb)
const Picker = ({ value, onChange, label }) => <input type="color" value={isHex(value) && value.length === 7 ? value : GREY} aria-label={label} onChange={e => onChange(e.target.value)} />;
function MachineRow({ name }) {
  const [s, patch] = useMachineSettings(name);
  return <Row label={name}><Picker value={s.color} label={name + " colour"} onChange={v => patch({ color: v })} /><code>{s.color || "none"}</code><Reset show={!!s.color} what={name} onClick={() => patch({ color: "" })} /></Row>;
}
// Colours tab: the interface colours, the metric colours, and a colour for each machine.
export default function CustomColors({ c, names }) {
  const warn = contrastWarning(c.look, c.base), item = ({ id, label }) => {
    const v = c.look.colors?.[id] || builtIn(id, c.base), path = ["colors", id];
    return <Row key={id} label={label}><Picker value={v} label={label + " colour"} onChange={x => c.edit(path, x)} /><code>{v}</code><Reset show={c.has(path)} what={label} onClick={() => c.reset(path)} /></Row>;
  };
  return (
    <div className="ctab">
      {warn && <p className="cwarn" role="status">{warn}</p>}
      <h5 className="chd">Interface</h5>{COLOR_ITEMS.map(item)}
      <h5 className="chd">Graphs</h5>{METRIC_ITEMS.map(item)}
      <h5 className="chd">Machines</h5>
      <p className="chint">A machine colour tints its card edge and its tile.</p>
      {names.length ? names.map(n => <MachineRow key={n} name={n} />) : <p className="chint">No machines yet.</p>}
    </div>);
}
