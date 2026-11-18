import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";
import { ioDrives, ioPts, ioNow, hoursText, healthRows, healthNote, sizeStr, scanView, HEALTH_NOTES } from "../src/disks.js";

test("drive speeds: live drives first, then ones only the history knows", () => {
  const d = { io: [["C:", 100, 50]] }, h = { extra: { "dr:C:": [[1, 5]], "dw:C:": [[1, 6]], "dr:D:": [[1, 7]] } };
  assert.deepEqual(ioDrives(d, h), ["C:", "D:"]);
  assert.deepEqual(ioDrives({}, undefined), []);
  assert.deepEqual(ioPts(h, "dw", "C:"), [[1, 6]]);
  assert.deepEqual(ioPts(h, "dw", "Z:"), []);
  assert.deepEqual(ioNow(d, "C:"), [100, 50]);
  assert.equal(ioNow(d, "D:"), null);
});

test("drive health reads in plain words", () => {
  assert.equal(hoursText(30), "30 hours");
  assert.equal(hoursText(120), "5 days");
  assert.equal(hoursText(17520), "2.0 years");
  const [a, b] = healthRows({ smart: [["Example_SSD_1TB", "SSD", true, 38.4, 9400, 12], ["1", "Example_HDD", false, null, null, null]] });
  assert.equal(a.name, "Example SSD 1TB");
  assert.equal(a.model, "SSD");
  assert.deepEqual(a.facts, ["38°C", "powered on 1.1 years", "12% worn"]);
  assert.deepEqual(b.facts, []);
  assert.equal(b.ok, false);
});

test("no health: the hint says what to do", () => {
  assert.match(HEALTH_NOTES.missing, /smartmontools/);
  assert.equal(healthNote({ smart_note: "missing" }), HEALTH_NOTES.missing);
  assert.equal(healthNote({ smart_note: "denied" }), HEALTH_NOTES.denied);
  assert.equal(healthNote({}), "");
  assert.equal(healthNote({ smart: [["a", "m", true]], smart_note: "missing" }), "");
});

test("sizes and the search view", () => {
  assert.equal(sizeStr(5 * 2 ** 40), "5.0 TB");
  assert.equal(sizeStr(92 * 2 ** 30), "92 GB");
  assert.equal(sizeStr(3 * 2 ** 20), "3.0 MB");
  assert.equal(sizeStr(100), "0 KB");
  assert.deepEqual(scanView(null), { phase: "idle" });
  assert.deepEqual(scanView({ state: "running", seen: 5 }), { phase: "running", seen: 5 });
  assert.equal(scanView({ state: "running" }).seen, 0);
  const done = scanView({ state: "done", folders: [{ path: "/a", bytes: 2 ** 31 }, { path: "/b", bytes: 1 }] });
  assert.equal(done.rows[0].pct, 100);
  assert.equal(done.rows[1].pct, 2);
  assert.equal(scanView({ state: "cancelled" }).phase, "cancelled");
  assert.equal(scanView({ state: "failed", error: "No." }).error, "No.");
  assert.match(scanView({ state: "failed" }).error, /did not work/);
});

test("the demo backend runs, lists and stops a biggest-folders search", async () => {
  const id = await handle("find_big_folders", { machine: "This PC", path: "D:\\" });
  assert.equal((await handle("get_big_folders", { job: id })).state, "running");
  const stopMe = await handle("find_big_folders", { machine: "This PC", path: "/" });
  await handle("cancel_big_folders", { job: stopMe });
  assert.equal((await handle("get_big_folders", { job: stopMe })).state, "cancelled");
  await assert.rejects(handle("find_big_folders", { machine: "This PC", path: "-rf" }), /folder path/);
  await assert.rejects(handle("find_big_folders", { machine: "nobody", path: "/" }), /not in the list/);
  await assert.rejects(handle("get_big_folders", { job: 999 }), /no longer/);
});

test("the demo machines carry drive speed, health and history", async () => {
  const { machines } = await handle("get_state");
  const pc = machines.find(m => m.name === "This PC"), srv = machines.find(m => m.name === "example-server");
  assert.ok(pc.d.io.length === 2 && pc.d.smart.length === 2);
  assert.equal(srv.d.smart_note, "missing");
  const h = await handle("get_history", { machine: "This PC", range: 3600 });
  assert.ok(h.extra["dr:C:"].length > 10 && h.extra["dw:D:"].length > 10);
});
