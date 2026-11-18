// Small controls shared by the Customize tabs.
export const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>{options.map(([k, l]) => <button key={k} className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>);
// "Reset" shows only when there is something to reset.
export const Reset = ({ show, onClick, what }) => <button className="creset" hidden={!show} onClick={onClick} aria-label={"Reset " + what} data-tip="Back to the theme's value">Reset</button>;
export const Toggle = ({ on, onChange, children }) => (
  <button role="switch" aria-checked={on} className="swrow" onClick={() => onChange(!on)}><i className={"sw" + (on ? " on" : "")} /><span>{children}</span></button>);
export const Row = ({ label, children }) => <div className="crow"><span className="clabel">{label}</span><div className="cctl">{children}</div></div>;
