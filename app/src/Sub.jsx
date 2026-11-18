import { useFold, foldProps } from "./fold.js";
import Collapse from "./Collapse.jsx";
// A small section inside a group that folds on its own. The choice is remembered under its id.
export default function Sub({ id, def = true, title, hint, children }) {
  const [open, flip] = useFold(id, def);
  return (
    <div className={"fsub" + (open ? "" : " shut")}>
      <h4 {...foldProps(open, flip)}><b className="chev">{open ? "▾" : "▸"}</b>{title}{hint && <em>{hint}</em>}</h4>
      <Collapse open={open}>{children}</Collapse>
    </div>);
}
