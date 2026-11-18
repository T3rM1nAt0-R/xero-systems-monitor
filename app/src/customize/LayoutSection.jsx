import { CARD_SIZES, COLUMNS, DENSITIES, HEADINGS, TAB_STYLES, valueOf } from "../theme/model.js";
import { Row, Seg } from "./controls.jsx";
// Layout: machine columns, the look of tabs and headings, how tightly things are packed and how tall the graphs are.
export default function LayoutSection({ c }) {
  const v = f => valueOf(c.look, "layout." + f), set = f => x => c.edit(["layout", f], x);
  return (
    <>
      <Row id="layout.cols" label="Machine columns" keys="columns grid side by side" c={c} hint="Machines in 1, 2 or 3 columns."><Seg label="Machine columns" value={v("cols")} options={COLUMNS} onChange={set("cols")} /></Row>
      <Row id="layout.tabs" label="Tab style" keys="tabs underline pill segmented" c={c}><Seg label="Tab style" value={v("tabs")} options={TAB_STYLES} onChange={set("tabs")} /></Row>
      <Row id="layout.heading" label="Headings" keys="caps capitals uppercase section title" c={c}><Seg label="Headings" value={v("heading")} options={HEADINGS} onChange={set("heading")} /></Row>
      <Row id="layout.density" label="Density" keys="spacing compact comfortable spacious padding gap" c={c}><Seg label="Density" value={v("density")} options={DENSITIES} onChange={set("density")} /></Row>
      <Row id="layout.card" label="Graph height" keys="card size small medium large" c={c} hint="Small, Medium and Large change how tall the graphs are."><Seg label="Graph height" value={v("card")} options={CARD_SIZES} onChange={set("card")} /></Row>
    </>);
}
