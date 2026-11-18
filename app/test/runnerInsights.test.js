import test from "node:test";
import assert from "node:assert/strict";
import { repoOk, prNumber, jobUrl, refUrl, labelUrl, isGithubUrl } from "../src/github.js";
import { historyRows, filterHistory, workflowsOf, resultKind } from "../src/history.js";
import { busyHeat, heatTip, dayLine, hour12 } from "../src/busy.js";
import { buildLanes } from "../src/lanes.js";

test("repoOk accepts owner/name only", () => {
  assert.equal(repoOk("example/project"), true);
  assert.equal(repoOk("a.b/c_d-e"), true);
  for (const bad of ["", "example", "a/b/c", "../x", "a/..", "a b/c", "a/b?x", "a/b#", "a\\b/c", null, undefined, 5, "/a", "a/"]) assert.equal(repoOk(bad), false, String(bad));
});
test("urls: the pull request when the ref is one, else the Actions page, else nothing", () => {
  assert.equal(prNumber("refs/pull/12/merge"), 12);
  assert.equal(prNumber("refs/heads/main"), null);
  assert.equal(prNumber("refs/pull/x/merge"), null);
  assert.equal(refUrl("example/project", "refs/pull/12/merge"), "https://github.com/example/project/pull/12");
  assert.equal(refUrl("example/project", "refs/heads/main"), "https://github.com/example/project/actions");
  assert.equal(refUrl("example", "refs/pull/1/merge"), null);
  assert.equal(jobUrl("example/project", 0), "https://github.com/example/project/actions");
  assert.equal(jobUrl("example/project", 7), "https://github.com/example/project/pull/7");
});
test("labelUrl reads the repository and PR number from a label or an Activity line", () => {
  assert.equal(labelUrl("PR #7 · fix · Build (example/project)"), "https://github.com/example/project/pull/7");
  assert.equal(labelUrl("main · Build (example/project)"), "https://github.com/example/project/actions");
  assert.equal(labelUrl("r1 finished (5 min, Failed): PR #7 · fix · Build (example/project)"), "https://github.com/example/project/pull/7");
  assert.equal(labelUrl("PR #7 · Build (project)"), null);
  assert.equal(labelUrl("runner r1 gone"), null);
  assert.equal(labelUrl("Build (../..)"), null);
  assert.equal(labelUrl(undefined), null);
});
test("isGithubUrl is strict", () => {
  assert.equal(isGithubUrl("https://github.com/example/project/pull/7"), true);
  for (const bad of ["https://github.com/", "http://github.com/a/b", "https://github.com.evil.example/a", "https://github.com/a/b?x=1", "javascript:alert(1)", null, "https://github.com/a b"]) assert.equal(isGithubUrl(bad), false, String(bad));
});

const row = (m, r, s, e, res, label) => [m, r, s, e, res, label];
const L = (n, flow, repo = "example/project") => `PR #${n} · b${n} · ${flow} (${repo})`;
test("history: newest first, one machine, capped, with workflow and url", () => {
  const rows = [row("m", "r1", 0, 100, "Succeeded", L(1, "Build")), row("o", "r1", 0, 500, "", "x"), row("m", "r2", 0, 300, "Failed", L(2, "Test")), row("m", "r1", 0, 200, "Canceled", L(3, "Build"))];
  const h = historyRows(rows, "m");
  assert.deepEqual(h.map(j => j.t1), [300, 200, 100]);
  assert.equal(h[0].flow, "Test"); assert.equal(h[0].kind, "failed"); assert.equal(h[1].kind, "stopped");
  assert.equal(h[0].url, "https://github.com/example/project/pull/2");
  assert.equal(historyRows(rows, "m", 2).length, 2);
  assert.deepEqual(workflowsOf(h), ["Build", "Test"]);
  assert.equal(resultKind(""), "unknown");
});
test("history filters: result, workflow and search words together", () => {
  const h = historyRows([row("m", "r1", 0, 100, "Succeeded", L(1, "Build")), row("m", "run-2", 0, 300, "Failed", L(2, "Test")), row("m", "r1", 0, 200, "", L(3, "Build"))], "m");
  assert.equal(filterHistory(h).length, 3);
  assert.equal(filterHistory(h, { kind: "failed" }).length, 1);
  assert.equal(filterHistory(h, { kind: "succeeded", flow: "Build" }).length, 1);
  assert.equal(filterHistory(h, { flow: "Build" }).length, 2);
  assert.equal(filterHistory(h, { q: "RUN-2" }).length, 1);
  assert.equal(filterHistory(h, { q: "pr #3 build" }).length, 1);
  assert.equal(filterHistory(h, { q: "nothing here" }).length, 0);
});
test("lanes give running bars a link and leave others to the label", () => {
  const l = buildLanes([], "m", { r1: true }, { r1: ["Build", "", "refs/pull/5/merge", "example/project"] }, { r1: 10 }, 0, 100);
  assert.equal(l[0][1][0].url, "https://github.com/example/project/pull/5");
});

const at = (y, mo, d, h, mi = 0) => new Date(y, mo, d, h, mi).getTime() / 1000;
test("heatmap: 7 rows of 24 cells, today last, shade is the share of runner time busy", () => {
  const now = at(2026, 5, 10, 15, 30);
  const rows = [row("m", "r1", at(2026, 5, 10, 14), at(2026, 5, 10, 15), "Failed", "x"), row("m", "r2", at(2026, 5, 10, 14, 30), at(2026, 5, 10, 15, 30), "Succeeded", "y"), row("o", "r1", at(2026, 5, 10, 14), at(2026, 5, 10, 15), "", "z")];
  const days = busyHeat(rows, "m", 2, [], now);
  assert.equal(days.length, 7); assert.equal(days[6].today, true); assert.equal(days[0].today, false);
  assert.ok(days.every(d => d.cells.length === 24));
  const t = days[6].cells;
  assert.equal(t[14].pct, 75);            // 60 + 30 busy minutes of 2 x 60
  assert.deepEqual([t[14].jobs, t[14].failed], [2, 1]);
  assert.equal(t[15].pct, 50);            // r2 for the 30 minutes that have happened, of 2 x 30
  assert.equal(t[16].pct, null);          // not yet
  assert.equal(t[3].pct, 0);
  assert.deepEqual([days[6].jobs, days[6].failed], [2, 1]);
  assert.equal(days[0].cells[0].pct, 0);
});
test("heatmap: a running job counts, a job across midnight shows in both days, no runners is 0%", () => {
  const now = at(2026, 5, 10, 12);
  const days = busyHeat([row("m", "r1", at(2026, 5, 9, 23, 30), at(2026, 5, 10, 0, 30), "", "x")], "m", 1, [at(2026, 5, 10, 11)], now);
  assert.equal(days[5].cells[23].pct, 50); assert.equal(days[6].cells[0].pct, 50); assert.equal(days[6].cells[11].pct, 100);
  assert.equal(days[5].jobs, 1); assert.equal(days[6].jobs, 1);   // a job counts once, on the day it began (the running one)
  assert.equal(busyHeat([], "m", 0, [], now)[6].cells[0].pct, 0);
});
test("heatmap text: 12-hour labels, tooltip and day line", () => {
  assert.deepEqual([0, 6, 12, 18, 23].map(hour12), ["12 AM", "6 AM", "12 PM", "6 PM", "11 PM"]);
  const d = { day: "Tue" };
  assert.equal(heatTip(d, { h: 15, pct: 80, jobs: 6, failed: 1 }), "Tue 3 PM · 80% busy · 6 jobs, 1 failed");
  assert.equal(heatTip(d, { h: 15, pct: 0, jobs: 0, failed: 0 }), "Tue 3 PM · 0% busy · no jobs");
  assert.equal(heatTip(d, { h: 15, pct: 12.4, jobs: 1, failed: 0 }), "Tue 3 PM · 12% busy · 1 job");
  assert.equal(heatTip(d, { h: 20, pct: null }), "Tue 8 PM · not yet");
  assert.equal(dayLine({ jobs: 0, failed: 0 }), "no jobs"); assert.equal(dayLine({ jobs: 5, failed: 2 }), "5 jobs, 2 failed");
});
