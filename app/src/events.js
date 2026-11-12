// Sorting the Activity list: what kind of event is this, and how loud should it look? Pure, so it is tested.
// kind: "fail" | "job" | "machine"   tone: "bad" (red dot) | "warn" (amber) | "n" (grey)
export function eventKind(text, machine) {
  const t = String(text || "");
  if (machine === "🔔") return { kind: "alert", tone: "warn" };   // an alert that fired (written by the window, not the collector)
  if (/ finished \(.*, (Failed)\)/.test(t) || / failed$| failed\b.*systemd|^service .* failed|container .* is (exited|dead|restarting)|keeps restarting|disappeared|went offline|runner .* gone/.test(t)) return { kind: "fail", tone: "bad" };
  if (/ started: | finished \(/.test(t)) return { kind: "job", tone: /, (Canceled|Cancelled|Abandoned)\)/.test(t) ? "warn" : "n" };
  if (/back online|is back|running again|recovered|runner .* back/.test(t)) return { kind: "machine", tone: "warn" };
  return { kind: "machine", tone: "n" };
}
export const FILTERS = [["all", "All"], ["fail", "Failures"], ["job", "Jobs"], ["machine", "Machines"], ["alert", "Alerts"]];
// How many failures are newer than `seen` (unix seconds). Drives the red badge on the Activity button.
export const unseenFailures = (events, seen) => events.filter(e => e[0] > seen && eventKind(e[2], e[1]).kind === "fail").length;
