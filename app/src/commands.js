import { ALERTS } from "./alerts.js";
import { groupLabel } from "./order.js";
// The one list of everything the Ctrl+K palette can do. It only wraps actions the app already has; `a` is a bag of them.
// Items: { id, section, label, words (extra search text), run }. Optional actions (foldAll, onLimits, setQuietOn) add their item only when passed in.
export function buildCommands(a) {
  const out = [], add = (section, label, run, words = "") => out.push({ id: section + ":" + label, section, label, words, run });
  for (const m of a.machines) {
    add("Machine", `Go to ${m.name}`, () => a.goMachine(m.name), "machine");
    for (const k of a.groupsOf(m)) add("Group", `${m.name} > ${groupLabel(k)}`, () => a.goGroup(m.name, k), "group");
  }
  for (const [l, s] of a.ranges) add("Time range", `Show ${l}`, () => a.setRange(s), "range graphs time");
  for (const [k, l] of [["dark", "Dark"], ["light", "Light"], ["system", "Windows"]]) add("Setting", `Theme: ${l}`, () => a.look.setTheme(k), "theme colours");
  for (const [k, l] of [["normal", "Normal"], ["large", "Large"]]) add("Setting", `Text size: ${l}`, () => a.look.setSize(k), "text size font");
  for (const r of a.refreshOptions) add("Setting", `Refresh every ${r < 60 ? r + " s" : "1 min"}`, () => a.setRefresh(r), "refresh rate");
  const flip = (label, on, set, words) => add("Setting", `${label}: turn ${on ? "off" : "on"}`, () => set(!on), words);
  flip("Always on top", a.pin, a.setPin, "pin top");
  flip("Compact view", a.compact, a.setCompact, "compact rows");
  add("Setting", "Mini corner view", a.toggleMini, "mini small corner");
  if (a.foldAll) { add("Setting", "Fold all cards", () => a.foldAll(true), "collapse"); add("Setting", "Unfold all cards", () => a.foldAll(false), "expand"); }
  for (const [k, l] of ALERTS) flip(`Alert: ${l}`, !!a.alertPrefs[k], on => a.setAlert(k, on), "notify notification");
  add("Setting", "Snooze alerts for 1 hour", a.snooze1h, "mute notifications");
  if (a.setQuietOn) flip("Quiet hours", !!a.quietOn, a.setQuietOn, "night mute");
  add("Setting", "Machines…", a.onMachines, "add remove edit");
  if (a.onLimits) add("Setting", "Limits…", a.onLimits, "thresholds warn");
  for (const n of a.hiddenNames || []) add("Machine", `Show hidden machine ${n}`, () => a.showMachine(n), "unhide hidden machine");
  add("Setting", "Check for updates", a.onCheck, "update version");
  return out;
}
