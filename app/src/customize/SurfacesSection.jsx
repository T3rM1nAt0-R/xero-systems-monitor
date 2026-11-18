import { GLASS_LEVELS, valueOf } from "../theme/model.js";
import { Row, Seg } from "./controls.jsx";
// Surfaces: how cards, menus and bars look as material.
export default function SurfacesSection({ c }) {
  return (
    <Row id="surface.glass" label="Glass" keys="frosted blur transparent flat" c={c} hint="Frosted cards, menus and bars. Off is plain and flat. It also turns off by itself when Windows asks for less transparency.">
      <Seg label="Glass" value={valueOf(c.look, "surface.glass")} options={GLASS_LEVELS} onChange={v => c.edit(["surface", "glass"], v)} /></Row>);
}
