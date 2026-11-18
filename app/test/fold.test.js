import test from "node:test";
import assert from "node:assert/strict";
import { isCalm } from "../src/calm.js";
import { cardOpen } from "../src/fold.js";
import { sparkPath } from "../src/spark.js";

const ok = { name: "example-server", d: { cpu: 10, temp: 40, docker: [["web", "running", "Up 2 hours"]], failed: [] } };
test("calm: a quiet machine is calm", () => assert.equal(isCalm(ok, {}, [], 1000), true));
test("calm: offline, hot, warm, failing container or service are not calm", () => {
  assert.equal(isCalm({ ...ok, err: "x" }, {}, [], 1000), false);
  assert.equal(isCalm(ok, { cpu: 5 }, [], 1000), false);
  assert.equal(isCalm({ ...ok, d: { ...ok.d, temp: 85 } }, {}, [], 1000), false);
  assert.equal(isCalm({ ...ok, d: { ...ok.d, docker: [["db", "restarting", "Restarting"]] } }, {}, [], 1000), false);
  assert.equal(isCalm({ ...ok, d: { ...ok.d, failed: ["backup.service"] } }, {}, [], 1000), false);
});
test("calm: a failed job in the last hour counts; an old one or another machine's does not", () => {
  assert.equal(isCalm(ok, {}, [["example-server", "r1", 100, 900, "Failed", "x"]], 1000), false);
  assert.equal(isCalm(ok, {}, [["example-server", "r1", 100, 900, "Failed", "x"]], 900 + 3601), true);
  assert.equal(isCalm(ok, {}, [["other", "r1", 100, 900, "Failed", "x"]], 1000), true);
  assert.equal(isCalm(ok, {}, [["example-server", "r1", 100, 900, "Succeeded", "x"]], 1000), true);
});
test("cardOpen: the calm switch folds calm machines, a click wins until the state changes", () => {
  assert.equal(cardOpen(false, true, null, true), true);
  assert.equal(cardOpen(false, true, null, false), false);
  assert.equal(cardOpen(true, true, null, true), false);
  assert.equal(cardOpen(true, false, null, false), true);
  assert.equal(cardOpen(true, true, { open: true, calm: true }, true), true);
  assert.equal(cardOpen(true, false, { open: false, calm: true }, true), true);
});
test("sparkPath: needs two points, stays inside the box, thins long series", () => {
  assert.equal(sparkPath([[0, 1]]), ""); assert.equal(sparkPath(undefined), "");
  assert.equal(sparkPath([[0, 0], [1, 100]], 100, 60, 14), "M0.0 13.0L60.0 1.0");
  assert.ok(sparkPath(Array.from({ length: 600 }, (_, i) => [i, i % 100])).split("L").length <= 62);
  assert.ok(sparkPath([[0, 2], [1, 4]], 0).startsWith("M"));
});
