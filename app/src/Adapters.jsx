import { adapterRows, wifiBars } from "./network.js";
// Network adapters (up or down, speed, address) and the Wi-Fi network with its signal. The address is shown only here, in the window.
export default function Adapters({ d }) {
  const rows = adapterRows(d), wifi = d.wifi;
  if (!rows.length && !wifi) return <div className="quiet">No adapter information yet.</div>;
  return (
    <div className="adapters">
      {wifi && <div className="arow wifi"><span className="adot up" aria-hidden="true" /><b>Wi-Fi: {wifi[0]}</b><span>{wifi[1]}% signal</span><span className="bars" role="img" aria-label={`Signal ${wifi[1]} percent`}>{[1, 2, 3, 4].map(i => <i key={i} className={i <= wifiBars(wifi[1]) ? "on" : ""} style={{ height: 4 + i * 3 }} />)}</span></div>}
      {rows.map(r => <div className="arow" key={r.name}><span className={"adot" + (r.up ? " up" : "")} aria-hidden="true" /><b>{r.name}</b><span>{r.up ? "Connected" : "Not connected"}</span><em>{[r.speed, r.ip].filter(Boolean).join(" · ")}</em></div>)}
    </div>);
}
