import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SECTIONS, activeSection } from "./find.js";
import { Find } from "./controls.jsx";
import ThemeSection from "./ThemeSection.jsx";
import ColoursSection from "./ColoursSection.jsx";
import TextSection from "./TextSection.jsx";
import ShapeSection from "./ShapeSection.jsx";
import SurfacesSection from "./SurfacesSection.jsx";
import GraphsSection from "./GraphsSection.jsx";
import LayoutSection from "./LayoutSection.jsx";
import MotionSection from "./MotionSection.jsx";
import { themeTitle } from "../theme/presets.js";
import usePick from "./usePick.js";
const BODY = { theme: ThemeSection, colors: ColoursSection, text: TextSection, shape: ShapeSection, surfaces: SurfacesSection, graphs: GraphsSection, layout: LayoutSection, motion: MotionSection };
const NOTES = { theme: "holds colours, text, glass, graphs, layout, motion", colors: "3 base colours", shape: "style, corners, borders, depth", surfaces: "glass, background, grain" };
const SPY_PAD = 24, PICK_PAD = 80;
// Ctrl+Z belongs to the text box while someone types in one (search, a name, pasted code); everywhere else it undoes the last change.
const typing = el => el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && ["text", "search"].includes(el.type));
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// The Customize panel: docked on the right (the window shrinks, nothing is covered), one scroll with every section, a sticky header with search, jump chips,
// undo / redo, hold-to-compare and close. Every change is applied to the whole window at once; `c` is useLook().custom.
export default function Customize({ c, onClose }) {
  const [q, setQ] = useState(""), [picking, setPicking] = useState(false), [active, setActive] = useState(SECTIONS[0][0]), body = useRef(null), raf = useRef(0);
  const { remember, undo, redo, setComparing } = c;
  useEffect(() => { remember(); document.documentElement.dataset.panel = "open"; return () => { delete document.documentElement.dataset.panel; }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- once: what the panel opened with
  useEffect(() => {
    const k = e => {
      if (e.key === "Escape") { if (picking) setPicking(false); else onClose(); }
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !typing(e.target) && (key === "z" || key === "y")) { e.preventDefault(); (key === "y" || e.shiftKey ? redo : undo)(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose, undo, redo, picking]);
  const spy = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = body.current; if (!el) return;
      const ids = SECTIONS.map(s => s[0]), tops = ids.map(id => el.querySelector("#csec-" + id)?.offsetTop ?? 0);
      setActive(activeSection(ids, tops, el.scrollTop + SPY_PAD));
    });
  }, []);
  // A click in pick mode: scroll the panel to that setting and flash it.
  const toSetting = useCallback(id => {
    const el = body.current?.querySelector(`[data-setting="${id}"]`); if (!el) return;
    setQ(""); setPicking(false);
    const top = el.getBoundingClientRect().top - body.current.getBoundingClientRect().top + body.current.scrollTop - PICK_PAD;
    body.current.scrollTo({ top, behavior: reduced() ? "auto" : "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }, []);
  const pick = usePick(picking, toSetting);
  const jump = id => { const el = body.current?.querySelector("#csec-" + id); if (el) body.current.scrollTo({ top: el.offsetTop - 4, behavior: reduced() ? "auto" : "smooth" }); };
  const hold = on => ({ onPointerDown: () => setComparing(true), onPointerUp: () => setComparing(false), onPointerLeave: () => setComparing(false), onBlur: () => setComparing(false), onKeyDown: e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setComparing(true); } }, onKeyUp: e => { if (e.key === " " || e.key === "Enter") setComparing(false); }, "aria-pressed": on });
  return createPortal(
    <>
    <aside className="cpanel" role="complementary" aria-label="Customize">
      <header className="chead2">
        <div className="ctitle"><h3>Customize</h3><small>{themeTitle(c.theme, c.dirty)}</small>
          <span className="cicons">
            <button className="ghost" disabled={!c.canUndo} onClick={c.undo} aria-label="Undo" data-tip="Undo (Ctrl+Z)">↶</button>
            <button className="ghost" disabled={!c.canRedo} onClick={c.redo} aria-label="Redo" data-tip="Redo (Ctrl+Y)">↷</button>
            <button className={"ghost" + (picking ? " on" : "")} onClick={() => setPicking(p => !p)} aria-pressed={picking} aria-label="Pick mode" data-tip="Pick: click anything in the window to edit it">⌖</button>
            <button className={"ghost" + (c.comparing ? " on" : "")} {...hold(c.comparing)} aria-label="Hold to compare" data-tip="Hold to see the look from when you opened this">👁</button>
            <button className="ghost" onClick={onClose} aria-label="Close" data-tip="Close (Esc)">✕</button></span></div>
        <input type="search" className="csearch" value={q} onChange={e => setQ(e.target.value)} placeholder={'Search settings, e.g. "corner" or "glass"'} aria-label="Search settings" />
        <nav className="cchips" aria-label="Sections">{SECTIONS.map(([id, label]) => <button key={id} className={"chip" + (active === id ? " on" : "")} aria-current={active === id} onClick={() => jump(id)}>{label}</button>)}</nav>
      </header>
      <Find.Provider value={q}>
        <div className={"cscroll" + (q ? " searching" : "")} ref={body} onScroll={spy}>
          {SECTIONS.map(([id, label]) => { const Body = BODY[id]; return <section key={id} id={"csec-" + id} className="csec"><h4 className="csh"><span>{label}</span><em>{NOTES[id]}</em></h4><Body c={c} /></section>; })}
          <p className="cnone">Nothing matches that. Try a shorter word.</p>
        </div>
      </Find.Provider>
    </aside>
    {picking && <><div className="pickbanner">Pick mode · click anything to edit it · Esc to stop</div><div className="pickbox" ref={pick.box} hidden><span ref={pick.label} /></div></>}
    </>, document.body);
}
