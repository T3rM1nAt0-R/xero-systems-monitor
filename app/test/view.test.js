import test from "node:test";
import assert from "node:assert/strict";
import { viewOf, viewChange, nextCompact, showStrip, fitsWindow, visibleMachines, hideName, showName } from "../src/view.js";
import { buildCommands } from "../src/commands.js";

test("view: which of Full, Compact, Mini shows", () => {
  assert.equal(viewOf(false, false), "full");
  assert.equal(viewOf(true, false), "compact");
  assert.equal(viewOf(true, true), "mini");
  assert.deepEqual(viewChange("compact"), { compact: true, mini: false });
  assert.deepEqual(viewChange("full"), { compact: false, mini: false });
  assert.deepEqual(viewChange("mini"), { compact: null, mini: true });
});
test("strip: on, off and the auto rule", () => {
  assert.equal(showStrip("on", 1, true), true);
  assert.equal(showStrip("on", 0, false), false);
  assert.equal(showStrip("off", 5, false), false);
  assert.equal(showStrip("auto", 1, false), false, "one machine needs no strip");
  assert.equal(showStrip("auto", 3, true), false, "everything fits");
  assert.equal(showStrip("auto", 3, false), true, "scrolling needs the strip");
  assert.equal(fitsWindow(700, 800), true);
  assert.equal(fitsWindow(801, 800), false);
});
test("hidden machines are filtered and restored", () => {
  const ms = [{ name: "a" }, { name: "b" }, { name: "c" }];
  assert.equal(visibleMachines(ms, []), ms);
  assert.deepEqual(visibleMachines(ms, ["b"]).map(m => m.name), ["a", "c"]);
  assert.deepEqual(hideName(["a"], "b"), ["a", "b"]);
  assert.deepEqual(hideName(["a"], "a"), ["a"]);
  assert.deepEqual(showName(["a", "b"], "a"), ["b"]);
});
test("palette offers Show hidden machine", () => {
  const shown = [];
  const items = buildCommands({ machines: [], hiddenNames: ["example-server"], showMachine: n => shown.push(n), ranges: [], refreshOptions: [], alertPrefs: {}, look: {}, setPin() {}, setCompact() {}, toggleMini() {}, setRange() {}, setRefresh() {}, snooze1h() {}, onMachines() {}, onCheck() {} });
  items.find(i => i.label === "Show hidden machine example-server").run();
  assert.deepEqual(shown, ["example-server"]);
});

test("C: Full goes to Compact, Compact to Full, and Mini leaves Mini for Compact", () => {
  assert.deepEqual(nextCompact(false, false), { compact: true, mini: false });
  assert.deepEqual(nextCompact(true, false), { compact: false, mini: false });
  assert.deepEqual(nextCompact(false, true), { compact: true, mini: false });
  assert.deepEqual(nextCompact(true, true), { compact: true, mini: false });
});
