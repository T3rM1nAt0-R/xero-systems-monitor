import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";
import { procRows, nextSort, rankRows, holdProgress, HOLD_MS, TOP_ROWS, memText, cpuText, RANGES } from "../src/procs.js";

const procs = [[10, "node", 4, 100, "user"], [20, "my_program", 30, 2048, ""], [30, "sshd", 0.5, 12, "root"]];

test("the process list sorts, filters and is capped at the top 50", () => {
  assert.deepEqual(procRows(procs).map(r => r.pid), [20, 10, 30], "busiest first by default");
  assert.deepEqual(procRows(procs, { key: "ram", desc: false }).map(r => r.pid), [30, 10, 20]);
  assert.deepEqual(procRows(procs, { key: "name", desc: false }).map(r => r.shown), ["my program", "node", "sshd"]);
  assert.deepEqual(procRows(procs, { filter: "ROOT" }).map(r => r.pid), [30], "a user matches");
  assert.deepEqual(procRows(procs, { filter: "my pro" }).map(r => r.pid), [20], "underscores read as spaces");
  assert.deepEqual(procRows(procs, { filter: "10" }).map(r => r.pid), [10], "an id matches");
  assert.deepEqual(procRows(procs, { limit: 1 }).length, 1);
  assert.deepEqual(procRows(undefined), []);
  const many = Array.from({ length: 80 }, (_, i) => [i, "p" + i, i, 1, ""]);
  assert.equal(procRows(many).length, TOP_ROWS);
});

test("a click on a column header sorts by it, a second click flips it", () => {
  assert.deepEqual(nextSort({ key: "cpu", desc: true }, "cpu"), { key: "cpu", desc: false });
  assert.deepEqual(nextSort({ key: "cpu", desc: true }, "name"), { key: "name", desc: false });
  assert.deepEqual(nextSort({ key: "name", desc: false }, "ram"), { key: "ram", desc: true });
  assert.deepEqual(nextSort({ key: "cpu", desc: true }, "nope"), { key: "nope", desc: false });
});

test("hold to confirm: about 800 ms, never below 0 or above 1", () => {
  assert.equal(HOLD_MS, 800);
  assert.equal(holdProgress(-5), 0);
  assert.equal(holdProgress(400), 0.5);
  assert.equal(holdProgress(5000), 1);
  assert.equal(holdProgress(100, 200), 0.5);
  assert.deepEqual([memText(2048), memText(300.4), cpuText(4.04), cpuText(30.2)], ["2.0 GB", "300 MB", "4.0%", "30%"]);
});

test("what was busy ranks by CPU or memory with bars relative to the biggest", () => {
  const ans = { minutes: 60, top: [["a_b", 5, 100, 10], ["c", 20, 50, 60], ["d", 1, 900, 5]] };
  const cpu = rankRows(ans);
  assert.deepEqual(cpu.map(r => [r.name, r.share]), [["c", 100], ["a b", 25], ["d", 5]]);
  assert.deepEqual(rankRows(ans, "ram").map(r => r.name), ["d", "a b", "c"]);
  assert.equal(rankRows(ans, "cpu", 2).length, 2);
  assert.deepEqual(rankRows({ minutes: 0, top: [] }), []);
  assert.deepEqual(rankRows(undefined), []);
  assert.deepEqual(RANGES.map(r => r[1]), [3600, 21600, 86400]);
});

test("the demo backend lists processes, ranks a range and ends a task", async () => {
  const { machines } = await handle("get_state");
  for (const m of machines) for (const [pid, name, cpu, mb, user] of m.d.procs) assert.ok(Number.isInteger(pid) && typeof name === "string" && cpu >= 0 && mb > 0 && typeof user === "string");
  assert.equal(machines[0].d.procs[0][4], "", "This PC does not report users");
  const a = await handle("get_busiest", { machine: "This PC", range: 3600 });
  assert.equal(a.minutes, 60);
  assert.ok(a.top.length > 3 && a.top.every(r => r.length === 4));
  assert.deepEqual(await handle("get_busiest", { machine: "nope", range: 3600 }), { minutes: 0, top: [] });
  assert.match(await handle("end_task", { machine: "This PC", pid: 1000, name: "my_app" }), /Ended my app/);
  await assert.rejects(handle("end_task", { machine: "This PC", pid: 1, name: "init" }), /system/);
  await assert.rejects(handle("end_task", { machine: "nope", pid: 5, name: "x" }), /not in the list/);
});
