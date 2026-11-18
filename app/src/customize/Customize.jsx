import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SECTIONS, activeSection } from "./find.js";
import { Find } from "./controls.jsx";
import ThemeSection from "./ThemeSection.jsx";
import ColoursSection from "./ColoursSection.jsx";
import TextSection from "./TextSection.jsx";
import SurfacesSection from "./SurfacesSection.jsx";
import GraphsSection from "./GraphsSection.jsx";
import LayoutSection from "./LayoutSection.jsx";
import MotionSection from "./MotionSection.jsx";
import { themeTitle } from "../theme/presets.js";
const BODY = { theme: ThemeSection, colors: ColoursSection, text: TextSection, surfaces: SurfacesSection, graphs: GraphsSection, layout: LayoutSection, motion: MotionSection };
const NOTES = { theme: "holds colours, text, glass, graphs, layout, motion", colors: "3 base colours" };
const SPY_PAD = 24;
// Ctrl+Z belongs to the text box while someone types in one (search, a name, pasted code); everywhere else it undoes the last change.
const typing = el => el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && ["text", "search"].includes(el.type));
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// The Customize panel: docked on the right (the window shrinks, nothing is covered), one scroll with every section, a sticky header with search, jump chips,
// undo / redo, hold-to-compare and close. Every change is applied to the whole window at once; `c` is useLook().custom.
export default function Customize({ c, onClose }) {
  const [q, setQ] = useState(""), [active, setActive] = useState(SECTIONS[0][0]), body = useRef(null), raf = useRef(0);
  const { remember, undo, redo, setComparing } = c;
  useEffect(() => { remember(); document.documentElement.dataset.panel = "open"; return () => { delete document.documentElement.dataset.panel; }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- once: what the panel opened with
  useEffect(() => {
    const k = e => {
      if (e.key === "Escape") onClose();
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !typing(e.target) && (key === "z" || key === "y")) { e.preventDefault(); (key === "y" || e.shiftKey ? redo : undo)(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose, undo, redo]);
  const spy = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = body.current; if (!el) return;
      const ids = SECTIONS.map(s => s[0]), tops = ids.map(id => el.querySelector("#csec-" + id)?.offsetTop ?? 0);
      setActive(activeSection(ids, tops, el.scrollTop + SPY_PAD));
    });
  }, []);
  const jump = id => { const el = body.current?.querySelector("#csec-" + id); if (el) body.current.scrollTo({ top: el.offsetTop - 4, behavior: reduced() ? "auto" : "smooth" }); };
  const hold = on => ({ onPointerDown: () => setComparing(true), onPointerUp: () => setComparing(false), onPointerLeave: () => setComparing(false), onBlur: () => setComparing(false), onKeyDown: e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setComparing(true); } }, onKeyUp: e => { if (e.key === " " || e.key === "Enter") setComparing(false); }, "aria-pressed": on });
  return createPortal(
    <aside className="cpanel" role="complementary" aria-label="Customize">
      <header className="chead2">
        <div className="ctitle"><h3>Customize</h3><small>{themeTitle(c.theme, c.dirty)}</small>
          <span className="cicons">
            <button className="ghost" disabled={!c.canUndo} onClick={c.undo} aria-label="Undo" data-tip="Undo (Ctrl+Z)">↶</button>
            <button className="ghost" disabled={!c.canRedo} onClick={c.redo} aria-label="Redo" data-tip="Redo (Ctrl+Y)">↷</button>
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
    </aside>, document.body);
}
