import { FONTS } from "../theme/fonts.js";
import { TEXT_LEVELS, WEIGHTS, SIZE_MIN, SIZE_MAX, SCALE_MIN, SCALE_MAX, valueOf } from "../theme/model.js";
import { Row, Range } from "./controls.jsx";
// Text: a font, a size and a weight for each level of text (machine name, header, section, numbers, labels, small text), and one size for everything.
// The font of the Numbers level is the number font: every big number uses it, so numbers can have a font of their own.
export default function TextSection({ c }) {
  return (
    <>
      <p className="chint">A font, size and weight for each kind of text. Sizes are in pixels at normal text size. The Numbers font is used for every big number.</p>
      {TEXT_LEVELS.map(({ id, label, size: def }) => {
        const t = c.look.text?.[id] || {}, path = ["text", id];
        return (
          <Row key={id} id={"text." + id} label={label} keys={"font size weight type text typeface " + (id === "number" ? "digits number font" : "")} c={c}>
            <select className="cfont" value={t.font || "system"} aria-label={label + " font"} onChange={e => c.edit([...path, "font"], e.target.value)}>
              {FONTS.map(f => <option key={f.id} value={f.id} style={f.stack ? { fontFamily: f.stack } : undefined}>{f.id === "system" ? "System" : f.label}</option>)}</select>
            <input type="number" min={SIZE_MIN} max={SIZE_MAX} step="1" value={t.size || def} aria-label={label + " size"} onChange={e => c.edit([...path, "size"], e.target.value === "" ? undefined : +e.target.value)} />
            <select value={t.weight || 0} aria-label={label + " weight"} onChange={e => c.edit([...path, "weight"], +e.target.value)}>{WEIGHTS.map(([w, l]) => <option key={w} value={w}>{l}</option>)}</select>
          </Row>);
      })}
      <Row id="scale" label="Text size overall" keys="zoom scale bigger smaller large text size" c={c}>
        <Range value={valueOf(c.look, "scale")} min={SCALE_MIN} max={SCALE_MAX} step={0.05} label="Text size overall" ends={["Small", "Large"]} show={v => Math.round(v * 100) + "%"} onChange={v => c.edit(["scale"], v)} /></Row>
    </>);
}
