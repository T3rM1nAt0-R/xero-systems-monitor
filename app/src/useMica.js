import { useEffect } from "react";
import * as api from "./api.js";
import { set, usePersisted } from "./store.js";
// "Mica behind glass" (Customize > Surfaces, off by default). The shell tries the Windows 11 backdrop; only when it says yes does the page become see-through
// (data-mica on <html>, styles/titlebar.css). Windows 10 or any failure leaves everything opaque, and `micaState` says why the switch did nothing.
export const useMicaSetting = () => usePersisted("mica", false);
export default function useMica() {
  const [on] = useMicaSetting();
  useEffect(() => {
    let live = true;
    const done = ok => { if (!live) return; if (ok) document.documentElement.dataset.mica = ""; else delete document.documentElement.dataset.mica; set("micaState", on ? (ok ? "on" : "unsupported") : "off", { persist: false }); };
    if (!on && !document.documentElement.hasAttribute("data-mica")) { done(false); return undefined; }
    api.setMica(on).then(done, () => done(false));
    return () => { live = false; };
  }, [on]);
}
