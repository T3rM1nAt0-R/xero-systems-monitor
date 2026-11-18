import { FONTS } from "../theme/fonts.js";
import { TEXT_LEVELS, WEIGHTS, SIZE_MIN, SIZE_MAX } from "../theme/model.js";
import { Reset, Row } from "./controls.jsx";
// Text tab: a font, a size and a weight for each level of text (machine name, headers, big numbers, labels, small text).
export default function CustomText({ c }) {
  return (
    <div className="ctab">
      <p className="chint">Each kind of text has its own font, size and weight. Sizes are in pixels at normal text scale.</p>
      {TEXT_LEVELS.map(({ id, label, size: def }) => {
        const t = c.look.text?.[id] || {}, path = ["text", id];
        return (
          <Row key={id} label={label}>
            <select value={t.font || "system"} aria-label={label + " font"} onChange={e => c.edit([...path, "font"], e.target.value === "system" ? undefined : e.target.value)}>
              {FONTS.map(f => <option key={f.id} value={f.id} style={f.stack ? { fontFamily: f.stack } : undefined}>{f.label}</option>)}
            </select>
            <input type="number" min={SIZE_MIN} max={SIZE_MAX} step="1" value={t.size || def} aria-label={label + " size"} onChange={e => c.edit([...path, "size"], e.target.value === "" ? undefined : +e.target.value)} />
            <select value={t.weight || 0} aria-label={label + " weight"} onChange={e => c.edit([...path, "weight"], +e.target.value || undefined)}>
              {WEIGHTS.map(([w, l]) => <option key={w} value={w}>{l}</option>)}
            </select>
            <Reset show={c.has(path)} what={label} onClick={() => c.reset(path)} />
          </Row>);
      })}
    </div>);
}
