// A small number with an optional label and unit; goes amber when `warn`. Used in the compact rows and the folded machine bars.
export default function N({ v, u = "", warn, label }) {
  return <span className={"cn" + (warn ? " warn" : "")}>{label && <small>{label}</small>}{v == null ? "–" : Math.round(v)}{u}</span>;
}
