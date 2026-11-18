import { useEffect, useRef } from "react";
import { setTrayStatus } from "./api.js";
import { trayStatus } from "./trayStatus.js";
import { motionFull } from "./motion.js";
// Keeps the tray icon's dot and hover text in step with the machines. Only calls the shell when they change.
// When the status turns red (and it was not red a moment ago) the icon is asked to pulse for a few seconds, if Motion is Full.
export default function useTrayStatus(machines, limitsOf, failedJobs) {
  const { state, tooltip } = trayStatus(machines, limitsOf, failedJobs), was = useRef(null);
  useEffect(() => {
    const pulse = state === "bad" && was.current != null && was.current !== "bad" && motionFull();
    was.current = state;
    setTrayStatus(state, tooltip, pulse).catch(() => {});
  }, [state, tooltip]);
}
