import test from "node:test";
import assert from "node:assert/strict";
import { trayStatus, machineStatus } from "../src/trayStatus.js";
import { handle } from "../src/fakeBackend.js";
import { setTrayStatus } from "../src/api.js";

const ok = (name, d = {}) => ({ name, err: null, d: { cpu: 23, ram: 40, disk: 50, ...d } });

test("calm machines make a green dot and the tooltip names the CPU", () => {
  const r = trayStatus([ok("a"), ok("b")], {});
  assert.deepEqual(r, { state: "calm", tooltip: "Xero Systems Monitor · 2 calm · CPU 23%" });
});
test("a hot machine needs a look (amber)", () => {
  const r = trayStatus([ok("a"), ok("b"), ok("c"), ok("d", { cpu: 95 })], {});
  assert.equal(r.state, "look"); assert.equal(r.tooltip, "Xero Systems Monitor · 3 calm, 1 needs a look · CPU 23%");
});
test("your own limits count", () => {
  assert.equal(machineStatus(ok("a", { cpu: 60 }), { a: { cpu: 50 } }), "look");
  assert.equal(machineStatus(ok("a", { disk: 95 }), {}), "look");
});
test("offline, failing containers or services, and unseen failed jobs are red", () => {
  assert.equal(trayStatus([ok("a"), { name: "b", err: "down", d: null }], {}).state, "bad");
  assert.equal(machineStatus(ok("a", { failed: [["x.service"]] }), {}), "bad");
  assert.equal(machineStatus(ok("a", { docker: [["web", "restarting", "Up"]] }), {}), "bad");
  const r = trayStatus([ok("a")], {}, 2);
  assert.equal(r.state, "bad"); assert.match(r.tooltip, /2 failed jobs/);
});
test("no machines yet: plain name only", () => {
  assert.deepEqual(trayStatus([], {}), { state: "calm", tooltip: "Xero Systems Monitor" });
});
test("the demo backend accepts set_tray_status", async () => {
  assert.equal(await setTrayStatus("calm", "x"), null);
  assert.equal(await handle("set_tray_status", { status: "bad", tooltip: "x" }), null);
});
