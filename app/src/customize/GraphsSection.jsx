import { GRAPH_STYLES, LINE_MIN, LINE_MAX, valueOf } from "../theme/model.js";
import { Row, Seg, Toggle } from "./controls.jsx";
const WIDTHS = Array.from({ length: LINE_MAX - LINE_MIN + 1 }, (_, i) => [LINE_MIN + i, String(LINE_MIN + i)]);
// Graphs: how every graph is drawn.
export default function GraphsSection({ c }) {
  const v = f => valueOf(c.look, "graph." + f), set = f => x => c.edit(["graph", f], x);
  const tog = (f, label, keys) => <Row id={"graph." + f} label={label} keys={keys} c={c}><Toggle on={v(f)} onChange={set(f)} label={label} /></Row>;
  return (
    <>
      <Row id="graph.style" label="Style" keys="line area bars step chart type" c={c}><Seg label="Graph style" value={v("style")} options={GRAPH_STYLES} onChange={set("style")} /></Row>
      <Row id="graph.width" label="Line width" keys="thickness stroke" c={c}><Seg label="Line width" value={v("width")} options={WIDTHS} onChange={set("width")} /></Row>
      {tog("grid", "Grid lines", "gridlines")}
      {tog("smooth", "Smooth the line", "curve")}
      {tog("limits", "Limit lines", "threshold warning")}
    </>);
}
