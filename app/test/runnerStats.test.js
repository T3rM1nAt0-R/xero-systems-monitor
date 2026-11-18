import test from "node:test";
import assert from "node:assert/strict";
import { runnerStats } from "../src/runnerStats.js";

const noon = new Date(2026, 5, 10, 12, 0, 0).getTime() / 1000;
test("runnerStats counts today's jobs, the success percent and the median time", () => {
  const rows = [
    ["a", "r1", noon - 600, noon - 300, "Succeeded", "x"], ["a", "r1", noon - 1000, noon - 700, "Succeeded", "x"],
    ["a", "r2", noon - 2000, noon - 1000, "Failed", "x"], ["b", "r1", noon - 100, noon - 50, "Succeeded", "x"],
    ["a", "r1", noon - 86400 * 2, noon - 86400 * 2 + 10, "Succeeded", "old"],
  ];
  assert.deepEqual(runnerStats(rows, "a", noon), { jobs: 3, success: 67, median: 300 });
});
test("runnerStats averages the two middle times and handles no jobs", () => {
  const rows = [["a", "r", noon - 500, noon - 400, "Succeeded", "x"], ["a", "r", noon - 300, noon - 100, "Succeeded", "x"]];
  assert.equal(runnerStats(rows, "a", noon).median, 150);
  assert.deepEqual(runnerStats([], "a", noon), { jobs: 0, success: null, median: null });
});
