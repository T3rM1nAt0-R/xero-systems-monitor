import test from "node:test";
import assert from "node:assert/strict";
import { busyRows, busyLine, memText, cpuText } from "../src/busyAt.js";
import { handle } from "../src/fakeBackend.js";

test("memory shows MB below a gigabyte and GB above", () => {
  assert.equal(memText(900.4), "900 MB"); assert.equal(memText(2150), "2.1 GB");
});
test("cpu keeps one decimal below 10 percent", () => { assert.equal(cpuText(4), "4.0%"); assert.equal(cpuText(32.4), "32%"); });
test("busyRows names programs plainly and marks several processes", () => {
  const rows = busyRows({ t: 1, top: [["build_tool", 32, 2150, 3], ["editor", 4, 900, 1]] });
  assert.deepEqual(rows, [{ name: "build tool ×3", cpu: "32%", mem: "2.1 GB" }, { name: "editor", cpu: "4.0%", mem: "900 MB" }]);
  assert.equal(busyLine({ t: 1, top: [["a", 1, 1, 1], ["b", 2, 2, 1]] }, 1), "a 1.0% · 1 MB");
});
test("an empty answer gives no rows", () => { assert.deepEqual(busyRows({}), []); assert.deepEqual(busyRows(null), []); });
test("the demo backend answers get_busy_at in the documented shape, and {} for an unknown machine", async () => {
  const r = await handle("get_busy_at", { machine: "This PC", t: Date.now() / 1000 - 600 });
  assert.ok(Number.isFinite(r.t) && r.top.length > 1);
  for (const [n, c, mb, k] of r.top) assert.ok(typeof n === "string" && Number.isFinite(c) && Number.isFinite(mb) && Number.isInteger(k));
  assert.deepEqual(r.top.map(x => x[1]), r.top.map(x => x[1]).sort((a, b) => b - a));
  assert.deepEqual(await handle("get_busy_at", { machine: "nope", t: 1 }), {});
});
