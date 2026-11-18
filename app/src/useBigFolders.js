import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api.js";
import { SCAN_POLL_MS } from "./disks.js";
// One biggest-folders search of one machine: start(path), cancel(), and the latest reply of get_big_folders (null before the first start).
// A search still running when the box closes is asked to stop, so nothing keeps working in the background for nobody.
export default function useBigFolders(machine) {
  const [reply, setReply] = useState(null), job = useRef(null), timer = useRef(0), alive = useRef(true);
  const stop = useCallback(() => { clearInterval(timer.current); timer.current = 0; }, []);
  const look = useCallback(async () => {
    const id = job.current; if (id == null) return;
    try { const r = await api.getBigFolders(id); if (!alive.current || job.current !== id) return; setReply(r); if (r.state !== "running") stop(); }
    catch (e) { if (alive.current) { setReply({ state: "failed", error: String(e.message || e) }); stop(); } }
  }, [stop]);
  const start = useCallback(async path => {
    stop(); setReply({ state: "running", seen: 0 });
    try { job.current = await api.findBigFolders(machine, path); timer.current = setInterval(look, SCAN_POLL_MS); look(); }
    catch (e) { job.current = null; setReply({ state: "failed", error: String(e.message || e) }); }
  }, [machine, look, stop]);
  const cancel = useCallback(() => { if (job.current != null) api.cancelBigFolders(job.current).catch(() => {}); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop(); if (job.current != null) api.cancelBigFolders(job.current).catch(() => {}); }; }, [stop]);
  return { reply, start, cancel };
}
