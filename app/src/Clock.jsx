import { useEffect, useState } from "react";
// The clock and "updated N s ago" tick on their own, so the rest of the window is not redrawn every second.
export function Clock() { const [t, setT] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setT(Date.now()), 15000); return () => clearInterval(id); }, []); return new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
export function Ago({ err, stamp, short }) {
  const [t, setT] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(id); }, []);
  const ago = stamp ? Math.max(0, Math.round((t - stamp) / 1000)) : null;
  return err ? (short ? "Offline" : "Can't reach the collector") : ago == null ? "Starting…" : short ? "Live" : `Live, updated ${ago < 2 ? "just now" : ago + " s ago"}`;
}
