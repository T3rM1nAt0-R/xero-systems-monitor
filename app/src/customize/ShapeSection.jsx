import { BORDERS, FAMILIES, valueOf } from "../theme/model.js";
import { Row, Range, Seg, Toggle } from "./controls.jsx";
import { familyEdits } from "./family.js";
// A tiny drawing of each style family, so the tiles show the look before you pick it.
const BLURBS = { rounded: "Today's look", sharp: "Square, flat tiles", terminal: "Mono, green on black", soft: "Neumorphic", blueprint: "Blue grid paper, white lines" };
const DRAW = {
  rounded: <rect x="3" y="6" width="94" height="26" rx="9" fill="none" stroke="currentColor" />, sharp: <rect x="3" y="6" width="94" height="26" fill="none" stroke="currentColor" />,
  terminal: <><rect x="3" y="6" width="94" height="26" fill="#000" stroke="#39ff6a" /><path d="M9 14l4 3-4 3M16 21h8" stroke="#39ff6a" fill="none" /></>,
  soft: <rect x="5" y="7" width="90" height="24" rx="12" fill="#262a33" stroke="none" />,
  blueprint: <><rect x="3" y="6" width="94" height="26" fill="#0b2e63" stroke="#fff" /><path d="M3 15h94M3 24h94M26 6v26M50 6v26M74 6v26" stroke="#ffffff44" /></>,
};
// Shape: the style family (Rounded, Sharp / Metro, Terminal, Soft, Blueprint), corner radius, borders and shadow depth.
export default function ShapeSection({ c }) {
  const v = f => valueOf(c.look, "shape." + f), set = f => x => c.edit(["shape", f], x), family = v("family");
  return (
    <>
      <Row id="shape.family" label="Style family" keys="rounded sharp metro terminal soft neumorphic blueprint style look" c={c} hint={FAMILIES.find(f => f[0] === family)?.[1] + " · tiles below"} />
      <div className="cgrid cfam" role="listbox" aria-label="Style family">
        {FAMILIES.map(([id, name]) => (
          <button key={id} role="option" aria-selected={family === id} className={"ctile" + (family === id ? " on" : "")} onClick={() => c.editMany(familyEdits(id), "family")}>
            <svg className="cthumb" viewBox="0 0 100 38" aria-hidden="true">{DRAW[id]}</svg><span className="ctname">{name}<small>{BLURBS[id]}</small></span></button>))}
      </div>
      <Row id="shape.scan" label="Scanlines" keys="crt terminal lines overlay" c={c}><Toggle on={v("scan")} onChange={x => c.edit(["shape", "scan"], x)} label="Scanlines" /><span className="chint">Terminal only</span></Row>
      <Row id="shape.radius" label="Corner radius" keys="corner round pill sharp rounded border radius" c={c}><Range value={v("radius")} min={0} max={100} label="Corner radius" ends={["Sharp", "Pill"]} show={x => (x === 0 ? "0 px" : x + "%")} onChange={set("radius")} /></Row>
      <Row id="shape.border" label="Borders" keys="outline line hairline bold none" c={c}><Seg label="Borders" value={v("border")} options={BORDERS} onChange={set("border")} /></Row>
      <Row id="shape.shadow" label="Shadow depth" keys="shadow elevation depth flat deep" c={c}><Range value={v("shadow")} min={0} max={100} label="Shadow depth" ends={["Flat", "Deep"]} show={x => x + "%"} onChange={set("shadow")} /></Row>
    </>);
}
