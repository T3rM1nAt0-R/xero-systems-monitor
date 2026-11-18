import { createContext, useContext } from "react";
import { matches } from "./find.js";
// Small controls shared by the Customize sections. A Row is one setting: it knows its id (so pick mode can find it) and hides itself when the search does not match it.
export const Find = createContext("");
export const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>{options.map(([k, l]) => <button key={k} className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>);
// "Reset" shows only when there is something to reset.
export const Reset = ({ show, onClick, what }) => <button className="creset ghost" hidden={!show} onClick={onClick} aria-label={"Reset " + what} data-tip="Back to the theme's value">↺</button>;
export const Toggle = ({ on, onChange, label, id }) => <button role="switch" aria-checked={on} aria-label={label} id={id} className="sw-btn" onClick={() => onChange(!on)}><i className={"sw" + (on ? " on" : "")} /></button>;
// One setting: a label on the left, the controls on the right, a reset arrow when `c.has(id)`.
export function Row({ id, label, keys = "", c, children, hint }) {
  const q = useContext(Find), hit = !!q && matches(q, label, keys, id), path = id.split(".");
  return (
    <div className={"crow" + (q ? (hit ? " hit" : " nomatch") : "")} data-setting={id}>
      <span className="clabel">{label}</span>
      <div className="cctl">{children}{c && <Reset show={c.has(path)} what={label} onClick={() => c.reset(path)} />}</div>
      {hint && <p className="chint">{hint}</p>}
    </div>);
}
// A group that is one search result as a whole (the base colours, a note).
export function Block({ id, label, keys = "", className = "", children }) {
  const q = useContext(Find), hit = !!q && matches(q, label, keys, id);
  return <div className={className + (q ? (hit ? " hit" : " nomatch") : "")} data-setting={id}>{children}</div>;
}
// A slider with its end labels and the current value.
export const Range = ({ value, min, max, step = 1, onChange, label, ends = ["", ""], show }) => (
  <div className="crange"><input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={e => onChange(+e.target.value)} />
    <span className="cends"><span>{ends[0]}</span><span>{show ? show(value) : value}</span><span>{ends[1]}</span></span></div>);
