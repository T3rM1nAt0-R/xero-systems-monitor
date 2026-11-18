import test from "node:test";
import assert from "node:assert/strict";
import { normGraphs, graphShown, graphClass, toggleGraph, togglePinGraph, setGraphSize, graphsFor, DEFAULT_GRAPHS } from "../src/graphPrefs.js";
import { markKind, autoMarks, MARK_MAX } from "../src/marks.js";
import { usualAt, unusualNow, UNUSUAL } from "../src/unusual.js";
import { offlineSpans, stripCells } from "../src/outage.js";
import { handle } from "../src/fakeBackend.js";

test("graph choices: junk is cleaned, hide, size and pin work", () => {
  assert.equal(normGraphs(null), DEFAULT_GRAPHS);
  assert.deepEqual(normGraphs({ off: ["cpu", "cpu", "x"], size: { cpu: "L", ram: "M", gpu: "XL", x: "S" }, pin: ["ram"] }), { off: ["cpu"], size: { cpu: "L" }, pin: ["ram"] });
  let g = toggleGraph(DEFAULT_GRAPHS, "cpu");
  assert.ok(!graphShown(g, "cpu") && graphShown(g, "ram"));
  g = togglePinGraph(g, "cpu");
  assert.ok(graphShown(g, "cpu"), "a pinned graph always shows");
  assert.equal(graphClass(setGraphSize(g, "cpu", "S"), "cpu"), "gs-s gpinned");
  assert.equal(graphClass(g, "ram"), "gs-m");
  assert.deepEqual(toggleGraph(toggleGraph(DEFAULT_GRAPHS, "ram"), "ram").off, []);
  assert.ok(!graphsFor({ d: {} }, {}).includes("gpu") && graphsFor({ d: { gpu: 3 } }, {}).includes("gpu"));
});

test("marks: events, restart, jobs (failed ones are their own kind), time in 12-hour form", () => {
  assert.deepEqual(["went offline", "back online", "container web keeps restarting", "machine restarted", "hello"].map(markKind), ["offline", "online", "container", "restart", ""]);
  const now = 100000, rows = [["a", "r1", now - 900, now - 600, "Failed", "PR #1"], ["a", "r1", now - 500, now - 100, "Succeeded", "PR #2"], ["b", "r1", now - 500, now - 100, "Failed", "x"]];
  const out = autoMarks({ events: [[now - 300, "a", "went offline"], [now - 200, "b", "went offline"]], rows, machine: "a", uptime: 1000, now, t0: now - 3600 });
  assert.deepEqual(out.map(x => x.kind), ["restart", "job", "fail", "job", "offline", "job"]);
  assert.match(out[0].text, /^\d{1,2}:\d{2}\s?(AM|PM) · /);
  assert.equal(autoMarks({ rows: Array.from({ length: 200 }, (_, i) => ["a", "r", i * 100, i * 100 + 50, "", "j" + i]), machine: "a", now: 1e6, t0: 0 }).length, MARK_MAX);
});

test("unusual for this time: needs enough days, a busy now, and a big enough gap", () => {
  const now = 10 * 86400, day = d => Array.from({ length: 6 }, (_, i) => [now - d * 86400 - 600 + i * 240, 30]);
  const pts = [1, 2, 3, 4].flatMap(day);
  assert.equal(Math.round(usualAt(pts, now)), 30);
  assert.equal(usualAt(pts.slice(0, 6), now), null, "one day is not enough");
  assert.equal(usualAt(null, now), null);
  assert.deepEqual(unusualNow(80, pts, now), { usual: 30 });
  assert.equal(unusualNow(30 + UNUSUAL.above_pct - 1, pts, now), null);
  assert.equal(unusualNow(null, pts, now), null);
  assert.equal(unusualNow(UNUSUAL.min_now_pct - 1, pts, now), null);
  assert.equal(usualAt([[now - 2000, 90], [now - 86400 - 12 * 3600, 90]], now, { ...UNUSUAL, min_days: 1 }), null, "other hours of the day do not count");
});

test("outage strip: offline spans from events, no data where nothing was stored", () => {
  const now = 1e6, ev = [[now - 5000, "a", "went offline"], [now - 3000, "a", "back online"], [now - 100, "b", "went offline"]];
  assert.deepEqual(offlineSpans(ev, "a", now), [[now - 5000, now - 3000]]);
  assert.deepEqual(offlineSpans(ev, "b", now), [[now - 100, now]]);
  assert.deepEqual(offlineSpans([], "a", now, true), [[now, now]]);
  const pts = Array.from({ length: 48 }, (_, i) => [now - 86400 + i * 1800 + 10, 1]).filter((_, i) => i < 10 || i > 20);
  const cells = stripCells({ events: ev, pts, machine: "a", now });
  assert.equal(cells.reduce((s, c) => s + c.w, 0).toFixed(3), "100.000");
  assert.deepEqual([...new Set(cells.map(c => c.status))].sort(), ["none", "off", "on"]);
  assert.ok(cells.every((c, i) => i === 0 || c.status !== cells[i - 1].status), "neighbours merged");
  assert.match(cells[0].text, /^(Online|Offline|No data) · \d{1,2}:\d{2}\s?(AM|PM) to /);
  assert.equal(stripCells({ events: [], pts: [], machine: "a", now, span: "week" }).length, 1);
});

test("demo backend: outage events, a gap in the week, and a busy PC that is unusual", async () => {
  const now = Date.now() / 1000, ev = await handle("get_events", { since: now - 7 * 86400, n: 400 });
  assert.ok(ev.some(e => e[2] === "went offline") && ev.some(e => e[2] === "back online") && ev.some(e => /keeps restarting/.test(e[2])));
  const h = await handle("get_history", { machine: "This PC", range: 7 * 86400 });
  assert.ok(h.cpu.some((p, i) => i && p[0] - h.cpu[i - 1][0] > 3600), "the PC has a stretch with no readings");
  assert.ok(unusualNow(82, h.cpu, now), "demo PC CPU looks unusual now");
});
