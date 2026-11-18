import { useEffect, useState } from "react";
import CustomText from "./CustomText.jsx";
import CustomColors from "./CustomColors.jsx";
import { CustomGraphs, CustomSize } from "./CustomGraphs.jsx";
import CustomThemes from "./CustomThemes.jsx";
import Preview from "./Preview.jsx";
const TABS = [["text", "Text"], ["colors", "Colours"], ["graphs", "Graphs"], ["size", "Size"], ["themes", "Themes"]];
// Customize…: fonts, colours, graph style, sizes and themes, with a live preview. Every change is applied to the whole window at once; `c` is useLook().custom.
export default function Customize({ c, names, onClose, start = "text" }) {
  const [tab, setTab] = useState(start);
  useEffect(() => { const k = e => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const body = { text: <CustomText c={c} />, colors: <CustomColors c={c} names={names} />, graphs: <CustomGraphs c={c} />, size: <CustomSize c={c} />, themes: <CustomThemes c={c} /> }[tab];
  return (
    <div className="modal" onClick={onClose}>
      <div className="dlg cust" role="dialog" aria-label="Customize" onClick={e => e.stopPropagation()}>
        <h3>Customize <small>{c.theme ? c.theme.name : "Current look"}{c.dirty ? " · changed" : ""}</small></h3>
        <div className="cbody">
          <div className="cmain">
            <div className="seg" role="tablist" aria-label="Customize sections">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
            <div className="cpane" key={tab} role="tabpanel">{body}</div>
          </div>
          <Preview look={c.look} />
        </div>
        <div className="mfoot"><button disabled={!c.dirty} onClick={c.resetAll}>Undo all changes</button><button className="cta" onClick={onClose}>Done</button></div>
      </div>
    </div>);
}
