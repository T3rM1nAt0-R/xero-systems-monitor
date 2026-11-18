import test from "node:test";
import assert from "node:assert/strict";
import { mergeOrder, applyOrder, moveTo, moveBy, stripOrder, normGroups, toggleHidden, moveGroup, groupsFor, groupLabel } from "../src/order.js";
import { filterItems, scoreItem } from "../src/search.js";
import { buildCommands } from "../src/commands.js";
import { tileModel, sparkPoints } from "../src/strip.js";

test("mergeOrder drops removed machines, keeps new ones at the end, ignores repeats and junk", () => {
  assert.deepEqual(mergeOrder(["b", "gone", "a", "b"], ["a", "b", "c"]), ["b", "a", "c"]);
  assert.deepEqual(mergeOrder(null, ["a", "b"]), ["a", "b"]);
});
test("applyOrder sorts items by the saved order", () => {
  assert.deepEqual(applyOrder([{ name: "a" }, { name: "b" }, { name: "c" }], ["c", "a"]).map(x => x.name), ["c", "a", "b"]);
});
test("moveTo and moveBy", () => {
  assert.deepEqual(moveTo(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(moveTo(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  assert.deepEqual(moveTo(["a", "b"], "a", "a"), ["a", "b"]);
  assert.deepEqual(moveTo(["a", "b"], "a", "zz"), ["a", "b"]);
  assert.deepEqual(moveBy(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveBy(["a", "b"], "a", -1), ["a", "b"]);
  assert.deepEqual(moveBy(["a", "b"], "x", 1), ["a", "b"]);
});
test("strip lists This PC first", () => {
  assert.deepEqual(stripOrder([{ name: "s" }, { name: "pc" }], "pc").map(m => m.name), ["pc", "s"]);
});
test("group choices: defaults, hide, show again, reorder, what a machine has", () => {
  const g = normGroups(null);
  assert.deepEqual(g.hidden, []); assert.equal(g.order[0], "cpu");
  const h = toggleHidden(g, "net"); assert.deepEqual(h.hidden, ["net"]); assert.deepEqual(toggleHidden(h, "net").hidden, []);
  assert.equal(moveGroup(g, "gpu", -1).order[0], "gpu");
  assert.deepEqual(normGroups({ order: ["disk"], hidden: ["net", "net", "bogus"] }).hidden, ["net"]);
  assert.deepEqual(groupsFor({ cpu: 1 }), ["cpu", "net", "disk"]);
  assert.deepEqual(groupsFor({ gpu: 3, runners: {}, docker: [] }), ["cpu", "gpu", "net", "disk", "run", "svc"]);
  assert.equal(groupLabel("net"), "Network"); assert.equal(groupLabel("x"), "x");
});

test("search: every word must match, starts rank first, empty keeps order", () => {
  const items = [{ label: "Theme: Dark" }, { label: "Go to Hoarder" }, { label: "Hoarder > GPU", words: "group" }];
  assert.deepEqual(filterItems(items, "").map(i => i.label), items.map(i => i.label));
  assert.deepEqual(filterItems(items, "hoarder").map(i => i.label), ["Hoarder > GPU", "Go to Hoarder"]);
  assert.deepEqual(filterItems(items, "hoa gpu").map(i => i.label), ["Hoarder > GPU"]);
  assert.deepEqual(filterItems(items, "group").map(i => i.label), ["Hoarder > GPU"]);
  assert.equal(scoreItem(items[0], "zzz"), null);
  assert.equal(scoreItem({ label: "x" }, "  "), 0);
});

const acts = extra => ({ machines: [{ name: "Hoarder", d: {} }], groupsOf: () => ["cpu", "gpu"], goMachine: () => {}, goGroup: () => {}, ranges: [["5 min", 300]], setRange: () => {}, look: { setTheme: () => {}, setSize: () => {} },
  refreshOptions: [3, 60], setRefresh: () => {}, pin: true, setPin: () => {}, compact: false, setCompact: () => {}, toggleMini: () => {}, alertPrefs: { offline: true }, setAlert: () => {}, snooze1h: () => {}, onMachines: () => {}, onCheck: () => {}, ...extra });
test("commands: machines, groups, ranges, settings; optional ones only when given", () => {
  const labels = buildCommands(acts()).map(c => c.label);
  for (const l of ["Go to Hoarder", "Hoarder > GPU", "Show 5 min", "Theme: Light", "Text size: Large", "Refresh every 1 min", "Always on top: turn off", "Compact view: turn on", "Alert: A machine goes offline: turn off", "Alert: A job fails: turn on", "Snooze alerts for 1 hour", "Machines…", "Check for updates"]) assert.ok(labels.includes(l), l);
  assert.ok(!labels.includes("Limits…") && !labels.includes("Fold all cards") && !labels.includes("Quiet hours…"));
  const more = buildCommands(acts({ onLimits: () => {}, foldAll: () => {}, quietHours: () => {} })).map(c => c.label);
  for (const l of ["Limits…", "Fold all cards", "Unfold all cards", "Quiet hours…"]) assert.ok(more.includes(l));
});
test("commands run the action they wrap", () => {
  const seen = [], cs = buildCommands(acts({ goGroup: (n, k) => seen.push([n, k]), setAlert: (k, on) => seen.push([k, on]), setPin: v => seen.push(["pin", v]) }));
  cs.find(c => c.label === "Hoarder > GPU").run(); cs.find(c => c.label.startsWith("Alert: A machine")).run(); cs.find(c => c.label.startsWith("Always on top")).run();
  assert.deepEqual(seen, [["Hoarder", "gpu"], ["offline", false], ["pin", false]]);
});

test("tile model and sparkline points", () => {
  const hm = () => "9:42 AM";
  assert.deepEqual(tileModel({ name: "a", d: { cpu: 12.4, ram: 50.6, temp: 40 } }, 0, hm), { name: "a", off: false, cpu: 12, mem: 51, gpu: null, temp: 40, seen: "" });
  assert.equal(tileModel({ name: "a", err: "x" }, 1, hm).seen, "last seen 9:42 AM");
  assert.equal(tileModel({ name: "a", err: "x" }, 0, hm).seen, "not seen yet");
  assert.equal(sparkPoints([[0, 0]], 10, 10), "");
  assert.equal(sparkPoints(null, 10, 10), "");
  assert.equal(sparkPoints([[0, 0], [10, 100]], 10, 10), "0.0,10.0 10.0,0.0");
  assert.equal(sparkPoints([[5, 50], [5, 500]], 10, 10), "0.0,5.0 0.0,0.0");
});
