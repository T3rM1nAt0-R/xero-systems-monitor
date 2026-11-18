import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";
import { TABS, TAB_IDS } from "../src/sections/meta.js";
import { TAB_PARTS, FULL, hasView, partShown, overviewParts, tabParts, availableTabs, effectiveTab, stepTab } from "../src/sections/tabs.js";
import { motionMs, MOTION_MS } from "../src/motion.js";
import { hwFacts } from "../src/hwStrip.js";

const bare = { d: { cpu: 5 } };
const rich = { d: { cpu: 5, top: [["node", 4, 100, 1]], runners: { r1: true }, jobs: {}, docker: [["web", "running", "Up 2 hours", "img", "", ""], ["db", "restarting", "Restarting", "img", "", ""]], hw: { cpu: "Example CPU", os: "Example OS" }, cores: [10, 20] } };

test("tab parts only name known tabs and known sections", () => {
  assert.deepEqual(Object.keys(TAB_PARTS), TAB_IDS);
  for (const parts of Object.values(TAB_PARTS)) for (const [id, v] of parts) assert.ok(["cpu", "gpu", "net", "disk", "run", "svc", "term"].includes(id) && v);
});

test("a bare machine shows Overview, Network and Disks only; Terminal always shows, Logs has no content yet", () => {
  assert.deepEqual(availableTabs(bare).map(t => t[0]), ["overview", "disks", "network", "terminal"]);
  const all = availableTabs(rich).map(t => t[0]);
  assert.deepEqual(all, ["overview", "hardware", "processes", "disks", "network", "services", "runners", "terminal"]);
  assert.ok(!all.includes("logs"));
  assert.equal(TABS.length, TAB_IDS.length);
});

test("Overview: graphs, compact runners, and only failing containers", () => {
  assert.deepEqual(overviewParts(rich).map(p => p.join(".")), ["cpu.graphs", "net.graphs", "disk.graphs", "run.compact", "svc.failing"]);
  assert.deepEqual(overviewParts(bare).map(p => p.join(".")), ["cpu.graphs", "net.graphs", "disk.graphs"]);
  const calm = { d: { docker: [["web", "running", "Up", "i", "", ""]] } };
  assert.ok(!partShown("svc", "failing", calm), "nothing failing, nothing in Overview");
  assert.ok(partShown("svc", "failing", { d: { docker: [], docker_err: "denied" } }));
  assert.ok(partShown("svc", FULL, calm));
});

test("pin to Overview: the pinned section shows whole; unpinning goes back; unknown or missing sections are ignored", () => {
  assert.deepEqual(overviewParts(rich, undefined, ["cpu"]).find(p => p[0] === "cpu"), ["cpu", FULL]);
  assert.deepEqual(overviewParts(rich, undefined, []).find(p => p[0] === "cpu"), ["cpu", "graphs"]);
  assert.ok(!overviewParts(bare, undefined, ["run", "nope"]).some(p => p[0] === "run"), "this machine has no runners");
  assert.deepEqual(tabParts("overview", rich, undefined, ["svc"]).find(p => p[0] === "svc"), ["svc", FULL]);
  assert.deepEqual(tabParts("runners", rich, undefined, ["cpu"]), [["run", FULL]], "pins only change Overview");
  assert.deepEqual(tabParts("logs", rich), []);
});

test("the remembered tab falls back to Overview when the machine no longer has it", () => {
  assert.equal(effectiveTab("runners", rich), "runners");
  assert.equal(effectiveTab("runners", bare), "overview");
  assert.equal(effectiveTab("nope", rich), "overview");
});

test("arrow keys move along the tabs, wrap round, and Home / End jump", () => {
  const tabs = availableTabs(rich);
  assert.equal(stepTab(tabs, "overview", "ArrowRight"), "hardware");
  assert.equal(stepTab(tabs, "overview", "ArrowLeft"), "terminal");
  assert.equal(stepTab(tabs, "terminal", "ArrowRight"), "overview");
  assert.equal(stepTab(tabs, "disks", "Home"), "overview");
  assert.equal(stepTab(tabs, "disks", "End"), "terminal");
  assert.equal(stepTab(tabs, "disks", "a"), "disks");
  assert.equal(stepTab([], "disks", "ArrowRight"), "disks");
  assert.equal(stepTab(tabs, "gone", "ArrowRight"), "overview");
});

test("hasView: full includes every slice; hardware names skip placeholder board names", () => {
  assert.ok(hasView(FULL, "graphs") && hasView("graphs", "graphs") && !hasView("graphs", "processes"));
  assert.deepEqual(hwFacts({ hw: { cpu: "Example CPU", board: "To be filled by O.E.M.", os: "Example OS" }, ram_gb: [3, 16] }), [["CPU", "Example CPU"], ["System", "Example OS"], ["Memory", "16 GB"]]);
  assert.deepEqual(hwFacts({}), []);
});

test("motion: full length normally, none when reduced", () => {
  assert.equal(motionMs(false), MOTION_MS);
  assert.equal(motionMs(true), 0);
  assert.equal(motionMs(), MOTION_MS, "no window in tests means normal motion");
});

test("demo machines each get at least Overview, and the demo runner machine gets a Runners tab", async () => {
  const state = await handle("get_state");
  for (const m of state.machines) assert.equal(availableTabs(m)[0][0], "overview");
  assert.ok(state.machines.some(m => availableTabs(m).some(t => t[0] === "runners")));
});
