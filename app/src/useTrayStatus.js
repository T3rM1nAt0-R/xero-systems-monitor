import { useEffect } from "react";
import { setTrayStatus } from "./api.js";
import { trayStatus } from "./trayStatus.js";
// Keeps the tray icon's dot and hover text in step with the machines. Only calls the shell when they change.
export default function useTrayStatus(machines, limits, failedJobs) {
  const { state, tooltip } = trayStatus(machines, limits, failedJobs);
  useEffect(() => { setTrayStatus(state, tooltip).catch(() => {}); }, [state, tooltip]);
}
