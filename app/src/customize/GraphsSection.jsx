import { GRAPH_STYLES, GRID_DENSITIES, LINE_MIN, LINE_MAX, valueOf } from "../theme/model.js";
import { Row, Seg, Toggle } from "./controls.jsx";
const WIDTHS = Array.from({ length: LINE_MAX - LINE_MIN + 1 }, (_, i) => [LINE_MIN + i, String(LINE_MIN + i)]);
// Graphs: how every graph is drawn.
export default function GraphsSection({ c, full }) {
  const v = f => valueOf(c.look, "graph." + f), set = f => x => c.edit(["graph", f], x);
  const tog = (f, label, keys, hint) => <Row id={"graph." + f} label={label} keys={keys} c={c} hint={hint}><Toggle on={v(f)} onChange={set(f)} label={label} /></Row>;
  return (
    <>
      {!full && <p className="chint">Applies in Full view</p>}
      <Row id="graph.style" label="Style" keys="line area bars step chart type" c={c}><Seg label="Graph style" value={v("style")} options={GRAPH_STYLES} onChange={set("style")} /></Row>
      <Row id="graph.width" label="Line width" keys="thickness stroke" c={c}><Seg label="Line width" value={v("width")} options={WIDTHS} onChange={set("width")} /></Row>
      {tog("gradient", "Gradient fill", "area fade shade")}
      {tog("glow", "Glow", "neon shine light")}
      {tog("dots", "Dots on points", "markers points", "Small dots along the line.")}
      {tog("smooth", "Smooth the line", "curve")}
      {tog("axes", "Axes", "labels time scale numbers")}
      {tog("grid", "Grid lines", "gridlines")}
      <Row id="graph.density" label="Grid density" keys="grid lines few many" c={c}><Seg label="Grid density" value={v("density")} options={GRID_DENSITIES} onChange={set("density")} /></Row>
      {tog("limits", "Limit lines", "threshold warning")}
    </>);
}
