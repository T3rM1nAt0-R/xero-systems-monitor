import { GRAPH_STYLES, LINE_MIN, LINE_MAX, CARD_SIZES, DENSITIES, SCALE_MIN, SCALE_MAX, GLASS_LEVELS, MOTION_LEVELS, graphOf, sizeOf, glassOf, motionOf } from "../theme/model.js";
import { Reset, Row, Seg, Toggle } from "./controls.jsx";
const WIDTHS = Array.from({ length: LINE_MAX - LINE_MIN + 1 }, (_, i) => [LINE_MIN + i, String(LINE_MIN + i)]);
// Graphs tab: how graphs are drawn.
export function CustomGraphs({ c }) {
  const g = graphOf(c.look), set = (k, v) => c.edit(["graph", k], v);
  return (
    <div className="ctab">
      <Row label="Style"><Seg label="Graph style" value={g.style} options={GRAPH_STYLES} onChange={v => set("style", v)} /><Reset show={c.has(["graph", "style"])} what="style" onClick={() => c.reset(["graph", "style"])} /></Row>
      <Row label="Line width"><Seg label="Line width" value={g.width} options={WIDTHS} onChange={v => set("width", v)} /><Reset show={c.has(["graph", "width"])} what="line width" onClick={() => c.reset(["graph", "width"])} /></Row>
      <Row label="Options"><div className="cchecks">
        <Toggle on={g.grid} onChange={v => set("grid", v)}>Grid lines</Toggle>
        <Toggle on={g.smooth} onChange={v => set("smooth", v)}>Smooth the line</Toggle>
        <Toggle on={g.limits} onChange={v => set("limits", v)}>Show limit lines</Toggle></div></Row>
    </div>);
}
// Size tab: card and graph size, how tight things are packed, and the text scale.
export function CustomSize({ c }) {
  const s = sizeOf(c.look), set = (k, v) => c.edit(["size", k], v);
  return (
    <div className="ctab">
      <Row label="Card size"><Seg label="Card size" value={s.card} options={CARD_SIZES} onChange={v => set("card", v)} /><Reset show={c.has(["size", "card"])} what="card size" onClick={() => c.reset(["size", "card"])} /></Row>
      <p className="chint">Small, Medium and Large change how tall the graphs are.</p>
      <Row label="Density"><Seg label="Density" value={s.density} options={DENSITIES} onChange={v => set("density", v)} /><Reset show={c.has(["size", "density"])} what="density" onClick={() => c.reset(["size", "density"])} /></Row>
      <Row label="Glass"><Seg label="Glass" value={glassOf(c.look)} options={GLASS_LEVELS} onChange={v => c.edit(["glass"], v)} /><Reset show={c.has(["glass"])} what="glass" onClick={() => c.reset(["glass"])} /></Row>
      <p className="chint">Frosted cards, menus and bars. Off is plain and flat. It also turns off by itself when Windows asks for less transparency.</p>
      <Row label="Motion"><Seg label="Motion" value={motionOf(c.look)} options={MOTION_LEVELS} onChange={v => c.edit(["motion"], v)} /><Reset show={c.has(["motion"])} what="motion" onClick={() => c.reset(["motion"])} /></Row>
      <p className="chint">Full: numbers roll, graphs slide and glow, cards glide. Subtle: only quick folds and fades. Off: nothing moves. It also turns off by itself when Windows asks for less motion.</p>
      <Row label="Text scale"><input type="range" min={SCALE_MIN} max={SCALE_MAX} step="0.05" value={s.scale} aria-label="Text scale" onChange={e => set("scale", +e.target.value)} /><code>{Math.round(s.scale * 100)}%</code><Reset show={c.has(["size", "scale"])} what="text scale" onClick={() => c.reset(["size", "scale"])} /></Row>
    </div>);
}
