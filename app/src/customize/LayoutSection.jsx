import { CARD_SIZES, DENSITIES, valueOf } from "../theme/model.js";
import { Row, Seg } from "./controls.jsx";
// Layout: how tightly things are packed and how tall the graphs are.
export default function LayoutSection({ c }) {
  const v = f => valueOf(c.look, "layout." + f), set = f => x => c.edit(["layout", f], x);
  return (
    <>
      <Row id="layout.density" label="Density" keys="spacing compact comfortable spacious padding gap" c={c}><Seg label="Density" value={v("density")} options={DENSITIES} onChange={set("density")} /></Row>
      <Row id="layout.card" label="Graph height" keys="card size small medium large" c={c} hint="Small, Medium and Large change how tall the graphs are."><Seg label="Graph height" value={v("card")} options={CARD_SIZES} onChange={set("card")} /></Row>
    </>);
}
