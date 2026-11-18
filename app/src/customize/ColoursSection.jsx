import { useContext, useState } from "react";
import { BASE_ITEMS, METRIC_ITEMS, STATUS_ITEMS, valueOf } from "../theme/model.js";
import { fullColors, contrastWarning } from "../theme/css.js";
import Collapse from "../Collapse.jsx";
import { Block, Find, Row, Toggle } from "./controls.jsx";
// Colours: three base colours that every other colour follows, a Fine-tune fold for the per-metric and status colours, and the colour-blind switch.
const Picker = ({ value, onChange, label }) => <input type="color" value={value} aria-label={label} onChange={e => onChange(e.target.value)} />;
export default function ColoursSection({ c }) {
  const q = useContext(Find), [open, setOpen] = useState(false), all = fullColors(c.look, c.base), warn = contrastWarning(c.look, c.base);
  const set = id => v => c.edit(["colors", id], v);
  const fine = ({ id, label }) => <Row key={id} id={"colors." + id} label={label} keys="colour color metric status" c={c}><Picker value={all[id]} label={label + " colour"} onChange={set(id)} /><code>{all[id]}</code></Row>;
  return (
    <>
      <Block id="colors.base" label="Base colours" keys="background text accent colour color" className="cblock">
        <div className="cbase">
          {BASE_ITEMS.map(({ id, label }) => (
            <label key={id} className="cswatch" data-setting={"colors." + id}><span className="cpick" style={{ background: all[id] }}><Picker value={all[id]} label={label + " colour"} onChange={set(id)} /></span><span>{label}</span><code>{all[id]}</code></label>))}
        </div>
        <p className="chint">These three make up every other colour: cards, lines, dimmed text, graph fills and hover shades.</p>
        {warn && <p className="cwarn" role="status">{warn}</p>}
        <button className="cfold ghost" aria-expanded={open} onClick={() => setOpen(o => !o)}><i className={"carat" + (open ? " open" : "")}>▸</i> <b>Fine-tune</b> <span>per-metric and status colours</span></button>
      </Block>
      <Collapse open={open || !!q}>
        <h5 className="chd">Per metric</h5>{METRIC_ITEMS.map(fine)}
        <h5 className="chd">Status</h5>{STATUS_ITEMS.map(fine)}
      </Collapse>
      <Row id="cb" label="Colour-blind safe" keys="color blind accessibility shapes status deuteranopia protanopia" hint="Status colours that are easier to tell apart, and status also by shape: ● ok, ▲ warning, ■ bad.">
        <Toggle on={valueOf(c.look, "cb")} onChange={v => c.edit(["cb"], v || undefined)} label="Colour-blind safe" /><span className="cshapes" aria-hidden="true">● ▲ ■</span></Row>
      <Block id="colors.machine" label="Machine colours" keys="machine colour color menu moved" className="cnote"><b>Machine colours moved</b><p>Each machine now has its own colour in its <b>⋯</b> menu.</p></Block>
    </>);
}
