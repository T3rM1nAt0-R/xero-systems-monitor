import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";
import { SECTION_META, SECTION_IDS, TABS, TAB_IDS, availableIds, sectionTitle, svcFacts } from "../src/sections/meta.js";
import { groupsFor, groupLabel, normGroups } from "../src/order.js";
import { normMachine, patchMachine, togglePinned, DEFAULT_MACHINE } from "../src/machineSettings.js";

test("registry: one entry per section, unique ids, every tab known, every function present", () => {
  assert.equal(new Set(SECTION_IDS).size, SECTION_META.length);
  assert.deepEqual(SECTION_IDS, ["cpu", "gpu", "net", "disk", "run", "svc"]);
  assert.equal(new Set(TAB_IDS).size, TABS.length);
  assert.deepEqual(TAB_IDS.slice(0, 2), ["overview", "hardware"]);
  for (const s of SECTION_META) {
    for (const f of ["accent", "available", "sub", "summary"]) assert.equal(typeof s[f], "function", s.id + "." + f);
    assert.match(s.accent({}), /^--[a-z-]+$/);
  }
});

test("order.js reads the registry: same titles, same availability, same default order", () => {
  for (const s of SECTION_META) assert.equal(groupLabel(s.id), s.title);
  assert.equal(sectionTitle("nope"), "nope");
  const m = { d: { gpu: 3, runners: {}, docker: [] } };
  assert.deepEqual(groupsFor(m.d), availableIds(m));
  assert.deepEqual(normGroups(null).order, SECTION_IDS);
  assert.deepEqual(groupsFor({ cpu: 1 }), ["cpu", "net", "disk"]);
  assert.ok(groupsFor({ cpu: 1, uptime: 5 }).includes("svc"), "every machine with readings has a Services section");
  assert.deepEqual(groupsFor({ cpu: 1 }, { gpu: [[1, 0], [2, 5]] }), ["cpu", "gpu", "net", "disk"], "history with GPU use shows the GPU section too");
});

test("golden: every section of the demo machines gives a title, a sub line and a summary", async () => {
  const state = await handle("get_state");
  assert.ok(state.machines.length >= 2);
  const seen = new Set();
  for (const m of state.machines) for (const s of SECTION_META) {
    if (!s.available(m)) continue;
    seen.add(s.id);
    const sum = s.summary(m, { full: "full in ~3 months", day: { done: 4, failed: 1, stopped: 0 } }), sub = s.sub(m, { day: { done: 4, failed: 1, stopped: 0 } });
    assert.equal(typeof sum, "string", `${m.name} ${s.id} summary`);
    assert.ok(sub === false || sub === undefined || sub === "" || typeof sub === "string", `${m.name} ${s.id} sub`);
    assert.doesNotMatch(String(sum) + String(sub), /undefined|NaN|\[object/, `${m.name} ${s.id} text`);
  }
  for (const id of ["cpu", "net", "disk"]) assert.ok(seen.has(id), id + " drawn for some demo machine");
});

test("summaries say what the folded section shows", () => {
  const m = { name: "example-server", d: { cpu: 46.2, temp: 52.1, gtemp: null, gpu: 10, disk: 62, down: 2e6, up: 1e5, ping: 12.4, speed: 1000, ip: "192.0.2.10", runners: { a: 1, b: 1 }, jobs: { a: ["x"] }, docker: [["web", "running", "Up 2 hours"], ["db", "restarting", "Restarting"]], failed: ["backup.service"] } };
  const by = id => SECTION_META.find(s => s.id === id);
  assert.equal(by("cpu").summary(m), "46% · 52°C");
  assert.equal(by("gpu").summary(m), "10% · –");
  assert.equal(by("net").sub(m), "1 Gbps link · 192.0.2.10");
  assert.match(by("net").summary(m), /ping 12 ms$/);
  assert.equal(by("disk").summary(m, { full: "full in ~3 months" }), "62% used · full in ~3 months");
  assert.equal(by("run").sub(m, { day: { done: 16, failed: 2, stopped: 1 } }), "1 busy · 1 idle · 16 jobs in 24 h, 2 failed, 1 stopped");
  assert.equal(by("run").summary(m), "1 busy");
  assert.equal(by("svc").summary(m), "2 failing");
  assert.equal(by("svc").sub(m), "1 running · 1 stopped · 2 failing");
  assert.equal(by("svc").accent(m), "--bad");
  assert.equal(svcFacts({ d: { docker: [] } }).bad, 0);
  assert.equal(by("svc").accent({ d: { docker: [] } }), "--c-svc");
});

test("machine settings: defaults are one frozen object, junk is cleaned, pins are known sections once", () => {
  assert.equal(normMachine(null), DEFAULT_MACHINE);
  assert.equal(normMachine("x"), DEFAULT_MACHINE);
  assert.deepEqual(normMachine({ color: "#4ade80", tab: "disks", pinned: ["cpu", "cpu", "nope", "svc"] }), { color: "#4ade80", tab: "disks", pinned: ["cpu", "svc"] });
  assert.deepEqual(normMachine({ color: "red; x", tab: "nope", pinned: "cpu" }), { color: "", tab: "overview", pinned: [] });
  assert.equal(normMachine({ color: "hsl(120 50% 40%)" }).color, "hsl(120 50% 40%)");
  const p = patchMachine({ tab: "network" }, { color: "#fff" });
  assert.deepEqual(p, { color: "#fff", tab: "network", pinned: [] });
  assert.deepEqual(togglePinned(p, "gpu").pinned, ["gpu"]);
  assert.deepEqual(togglePinned(togglePinned(p, "gpu"), "gpu").pinned, []);
});
