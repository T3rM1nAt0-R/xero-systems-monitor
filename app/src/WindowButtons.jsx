import { useEffect, useState } from "react";
import * as api from "./api.js";
// The window's own minimise, maximise / restore and close buttons (the system frame is off). In the small mini window only Close is shown.
// Close asks the shell, which hides to the tray or ends the app, whichever you chose. In a browser the buttons are there but do nothing.
const Icon = ({ d }) => <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1"><path d={d} /></svg>;
const MIN = "M0 5.5h10", MAX = "M.5.5h9v9h-9z", RESTORE = "M2.5 2.5v-2h7v7h-2M.5 2.5h7v7h-7z", CLOSE = "M0 0l10 10M10 0L0 10";
export default function WindowButtons({ mini }) {
  const [max, setMax] = useState(false);
  useEffect(() => { const f = () => api.winIsMaximized().then(m => setMax(!!m), () => {}); f(); return api.onWinResized(f); }, []);
  return (
    <div className="winbtns" role="group" aria-label="Window">
      {!mini && <button className="wbtn" aria-label="Minimise" data-tip="Minimise" onClick={() => api.winMinimize()}><Icon d={MIN} /></button>}
      {!mini && <button className="wbtn" aria-label={max ? "Restore" : "Maximise"} data-tip={max ? "Restore" : "Maximise"} onClick={() => api.winToggleMaximize()}><Icon d={max ? RESTORE : MAX} /></button>}
      <button className="wbtn close" aria-label="Close" data-tip="Close" onClick={() => api.winClose()}><Icon d={CLOSE} /></button>
    </div>);
}
