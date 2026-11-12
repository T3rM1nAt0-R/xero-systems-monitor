import test from "node:test";
import assert from "node:assert/strict";
import { hotMin, isWarn, WATCH, rate, prOf } from "../src/format.js";
import { buildLanes } from "../src/lanes.js";

test("hotMin: milliseconds in, whole minutes out, at least 1", () => {
  assert.equal(hotMin(0, 5 * 60000), 5);
  assert.equal(hotMin(1000, 1500), 1);
});
test("one warn list: ram is not in it, limits are inclusive", () => {
  assert.deepEqual(WATCH, ["cpu", "temp", "gtemp"]);
  assert.equal(isWarn("cpu", 90), true); assert.equal(isWarn("cpu", 89.9), false); assert.equal(isWarn("cpu", null), false);
});
test("rate picks a unit", () => { assert.deepEqual(rate(1500), ["1.5", "KB/s"]); assert.deepEqual(rate(5), ["5", "B/s"]); });
test("prOf", () => { assert.equal(prOf("refs/pull/12/merge"), "#12"); assert.equal(prOf("refs/heads/x"), ""); });

const row = (m, r, s, e, res, label) => [m, r, s, e, res, label];
test("lanes: finished jobs become bars, with their result", () => {
  const l = buildLanes([row("m", "r1", 80, 200, "Failed", "PR #1"), row("other", "r9", 100, 150, "", "y")], "m", { r1: false }, {}, {}, 0, 300);
  assert.deepEqual(l, [["r1", [{ s: 80, e: 200, label: "PR #1", res: "Failed" }]]]);
});
test("lanes: running job is open to now, and a lane with nothing since t0 drops", () => {
  const l = buildLanes([row("m", "old", 1, 10, "", "z")], "m", {}, { r2: ["Job"] }, { r2: 250 }, 100, 300);
  assert.deepEqual(l, [["r2", [{ s: 250, e: 300, label: "Job", run: true }]]]);
});
import { machineAlerts, failedAlerts, jobStats } from "../src/alerts.js";
const mm = (name, extra = {}) => ({ name, err: null, gone: [], ...extra });
test("alerts: nothing on the first look, then offline and runner-gone once each", () => {
  const first = machineAlerts(null, [mm("a")]); assert.deepEqual(first.alerts, []);
  const off = machineAlerts(first.next, [mm("a", { err: "offline" })]); assert.equal(off.alerts.length, 1); assert.equal(off.alerts[0].kind, "offline");
  assert.equal(machineAlerts(off.next, [mm("a", { err: "offline" })]).alerts.length, 0);   // still offline: no repeat
  const g = machineAlerts(first.next, [mm("a", { gone: ["r1"] })]); assert.equal(g.alerts[0].kind, "runner");
  assert.equal(machineAlerts(g.next, [mm("a", { gone: ["r1"] })]).alerts.length, 0);
});
test("alerts: high CPU alerts after 10 minutes, once", () => {
  const t = 1e12, first = machineAlerts(null, [mm("a")], {}, t);
  const early = machineAlerts(first.next, [mm("a")], { a: { cpu: t - 5 * 60000 } }, t); assert.equal(early.alerts.length, 0);
  const late = machineAlerts(early.next, [mm("a")], { a: { cpu: t - 11 * 60000 } }, t); assert.equal(late.alerts[0].kind, "hot");
  assert.equal(machineAlerts(late.next, [mm("a")], { a: { cpu: t - 12 * 60000 } }, t).alerts.length, 0);
});
test("alerts: failed jobs only after the first look, never twice", () => {
  const r1 = [row("m", "r1", 50, 100, "Failed", "old")];
  const a = failedAlerts(r1, null); assert.deepEqual(a.alerts, []); assert.equal(a.after, 100);
  const r2 = [...r1, row("m", "r1", 120, 150, "Succeeded", "ok"), row("m", "r1", 160, 200, "Failed", "new")];
  const b = failedAlerts(r2, a.after); assert.equal(b.alerts.length, 1); assert.match(b.alerts[0].body, /new/);
  assert.equal(failedAlerts(r2, b.after).alerts.length, 0);
});
test("jobStats counts finished, failed and stopped in the window", () => {
  const r = [row("m", "a", 0, 10, "Failed", "x"), row("m", "a", 0, 20, "Canceled", "x"), row("m", "a", 0, 30, "Succeeded", "x"), row("m", "a", 0, 40, "", "x"), row("m", "a", 0, 5, "Failed", "old"), row("o", "a", 0, 30, "", "x")];
  assert.deepEqual(jobStats(r, "m", 10), { done: 4, failed: 1, stopped: 1 });
});

import { busyByDay } from "../src/busy.js";
test("busy per day: 2 runners, one busy for 6 h today (noon) is 50%", () => {
  const noon = new Date(); noon.setHours(12, 0, 0, 0); const now = noon.getTime() / 1000;
  const days = busyByDay([["m", "r1", now - 6 * 3600, now, "", "x"]], "m", 2, [], now, 3);
  assert.equal(days.length, 3); assert.equal(days[2].today, true); assert.ok(Math.abs(days[2].pct - 25) < 0.01, String(days[2].pct));   // 6 h busy of 2 x 12 h so far
  assert.equal(days[0].pct, 0);
});
test("busy per day: a job running now counts, and a job across midnight is split", () => {
  const noon = new Date(); noon.setHours(12, 0, 0, 0); const now = noon.getTime() / 1000;
  const d = busyByDay([["m", "r1", now - 86400 - 3600, now - 86400 + 3600, "", "x"]], "m", 1, [now - 3600], now, 2);
  assert.ok(d[0].pct > 0 && d[0].pct < 100); assert.ok(Math.abs(d[1].pct - (100 * 3600 / 43200)) < 0.01);
});

test("alerts: a container that falls over alerts once; a clean exit does not", () => {
  const ok = { docker: [["web", "running", "Up 1 hour", "i"]] }, first = machineAlerts(null, [mm("a", { d: ok })]);
  const down = machineAlerts(first.next, [mm("a", { d: { docker: [["web", "exited", "Exited (1) 3 minutes ago", "i"]], failed: ["x.service"] } })]);
  assert.deepEqual(down.alerts.map(a => a.kind), ["svc", "svc"]);
  assert.equal(machineAlerts(down.next, [mm("a", { d: { docker: [["web", "exited", "Exited (1) 3 minutes ago", "i"]], failed: ["x.service"] } })]).alerts.length, 0);
  assert.equal(machineAlerts(first.next, [mm("a", { d: { docker: [["web", "exited", "Exited (0) 3 minutes ago", "i"]] } })]).alerts.length, 0);
});

import { eventKind, unseenFailures } from "../src/events.js";
test("events: failures are red, job starts grey, recoveries amber", () => {
  assert.deepEqual(eventKind("runner-1 finished (6 min, Failed): PR #748"), { kind: "fail", tone: "bad" });
  assert.deepEqual(eventKind("container db is exited"), { kind: "fail", tone: "bad" });
  assert.equal(eventKind("container web disappeared (was Up 1 hour)").tone, "bad");
  assert.deepEqual(eventKind("runner-2 started: PR #750 · Fast check"), { kind: "job", tone: "n" });
  assert.deepEqual(eventKind("runner-2 finished (3 min, Succeeded): x"), { kind: "job", tone: "n" });
  assert.deepEqual(eventKind("back online"), { kind: "machine", tone: "warn" });
  assert.equal(unseenFailures([[10, "a", "went offline"], [20, "a", "back online"], [30, "b", "runner-1 finished (1 min, Failed): x"]], 15), 1);
});

import { diskAlerts, eventAlerts } from "../src/alerts.js";
test("alerts: disk full by percent or by forecast, once per day; flapping container from events", () => {
  const m = (storage, name = "a") => ({ name, err: null, d: { storage } }), t = 1e12;
  assert.equal(diskAlerts([m([["C:", 95, 100]])], {}, t)[0].kind, "disk");
  assert.match(diskAlerts([m([["C:", 50, 100]])], { a: { days: 9 } }, t)[0].title, /fills in about 9 days/);
  assert.equal(diskAlerts([m([["C:", 50, 100]])], { a: { days: 90 } }, t).length, 0);
  assert.equal(diskAlerts([m([["C:", 95, 100]])], {}, t)[0].key, diskAlerts([m([["C:", 95, 100]])], {}, t + 3600000)[0].key);   // same day, same key
  const first = eventAlerts([[10, "h", "container api keeps restarting (4 state changes in 30 min)"]], null); assert.equal(first.alerts.length, 0);
  const next = eventAlerts([[20, "h", "container api keeps restarting (4 state changes in 30 min)"], [10, "h", "x"]], first.after); assert.equal(next.alerts[0].title, "container api keeps restarting");
});

import { jobTrends, jobName } from "../src/trends.js";
test("trends: workflow names, averages, change against the week before, slowest jobs", () => {
  const now = 20 * 86400, row = (daysAgo, mins, res, label) => ["h", "runner-1", now - daysAgo * 86400 - mins * 60, now - daysAgo * 86400, res, label];
  assert.equal(jobName("PR #744 · feat-x · Fast check (example-repo)"), "Fast check"); assert.equal(jobName("Unity compile"), "Unity compile");
  const rows = [row(1, 10, "Succeeded", "PR #1 · a · Fast check (repo)"), row(2, 20, "Failed", "PR #2 · b · Fast check (repo)"), row(9, 5, "Succeeded", "PR #3 · c · Fast check (repo)"), row(10, 5, "Succeeded", "PR #4 · d · Fast check (repo)"), row(3, 40, "Succeeded", "Unity compile")];
  const t = jobTrends(rows, "h", now), f = t.workflows.find(w => w.name === "Fast check");
  assert.equal(f.runs, 2); assert.equal(f.avg, 15); assert.equal(f.prev, 5); assert.equal(f.change, 2); assert.equal(f.failed, 1);
  assert.equal(t.slow[0].mins, 40); assert.equal(t.workflows[0].name, "Unity compile");   // most total time first
  assert.equal(jobTrends(rows, "other", now).workflows.length, 0);
});
