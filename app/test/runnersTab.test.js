import test from "node:test";
import assert from "node:assert/strict";
import { runnerRows, queueRows, bytesText } from "../src/runnerList.js";
import { cleanSize, miniColumns } from "../src/useMiniSize.js";
import { handle } from "../src/fakeBackend.js";

test("runner rows: status, job, time in job, size once asked", () => {
  const d = { runners: { b: true, a: false }, jobs: { b: ["Build", "", "refs/pull/7/merge", "x/y"] } };
  const rows = runnerRows(d, { b: 1000 }, ["c"], 1125, { a: 5e8 });
  assert.deepEqual(rows.map(r => [r.name, r.status, r.job, r.inJob, r.size]), [["a", "idle", "", "", 5e8], ["b", "busy", "Build #7", "2m 05s", undefined], ["c", "gone", "", "", undefined]]);
  assert.deepEqual(runnerRows({}, {}, [], 0), []);
});

test("queue rows: longest wait first; absent when the machine cannot tell", () => {
  assert.deepEqual(queueRows({ queued: [["B", 900], ["A", 100]] }, 1000).map(q => q.label), ["A", "B"]);
  assert.deepEqual(queueRows({}, 1000), []);
});

test("sizes read well", () => {
  assert.deepEqual([null, 3.4e9, 8.12e8, 500].map(bytesText), ["–", "3.4 GB", "812 MB", "1 KB"]);
});

test("mini size: only sensible sizes are kept, columns follow the width", () => {
  assert.deepEqual(cleanSize({ w: 400.4, h: 300 }), { w: 400, h: 300 });
  assert.equal(cleanSize({ w: 10, h: 300 }), null);
  assert.equal(cleanSize(null), null);
  assert.deepEqual([300, 480, 719, 720, 1000].map(miniColumns), [1, 2, 2, 3, 3]);
});

test("demo backend answers work sizes and a queue", async () => {
  const sizes = await handle("get_work_size", { machine: "example-server" });
  assert.ok(sizes.length && sizes.every(s => typeof s.runner === "string"));
  const st = await handle("get_state");
  assert.ok(st.machines.find(m => m.name === "example-server").d.queued.length > 0);
  assert.equal(await handle("set_mini_size", { width: 400, height: 300 }), null);
});
