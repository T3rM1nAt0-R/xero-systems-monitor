import { DEFAULT_QUIET, TIME_OPTIONS, muteLabel } from "./quiet.js";
// Quiet hours and the muted-alerts list, inside More > Notify me when…
export default function QuietMenu({ quiet = DEFAULT_QUIET, setQuiet, muted = [], onMute }) {
  const set = patch => setQuiet(q => ({ ...DEFAULT_QUIET, ...q, ...patch }));
  const pick = (key, label) => <label>{label}<select value={quiet[key]} onChange={e => set({ [key]: e.target.value })}>{TIME_OPTIONS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select></label>;
  return <>
    <button role="menuitemcheckbox" aria-checked={!!quiet.on} className="mrow2" onClick={() => set({ on: !quiet.on })}><span className="mtxt">Quiet hours</span><i className={"sw" + (quiet.on ? " on" : "")} /></button>
    {quiet.on && <div className="mseg quiettimes">{pick("from", "From")}{pick("to", "to")}<small>Pop-ups wait, except “offline”.</small></div>}
    {muted.length > 0 && <div className="mutedlist" role="group" aria-label="Muted alerts"><div className="mlabel">Muted alerts</div>
      {muted.map(x => <div className="mseg" key={x.machine + "|" + x.kind}><span>{muteLabel(x)}</span><button onClick={() => onMute(x.machine, x.kind, false)}>Unmute</button></div>)}</div>}
  </>;
}
