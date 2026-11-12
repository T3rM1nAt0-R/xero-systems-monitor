// A labelled on/off switch (same look as the ones in the More menu). Use it instead of a native checkbox.
export default function Switch({ on, onChange, children }) {
  return <button type="button" role="switch" aria-checked={!!on} className="swrow" onClick={() => onChange(!on)}><i className={"sw" + (on ? " on" : "")} />{children}</button>;
}
