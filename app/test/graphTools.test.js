import test from "node:test";
import assert from "node:assert/strict";
import { clipSeries, shiftSeries, zoomRange, toCsv, fileName, shade, MIN_ZOOM } from "../src/graphTools.js";

test("clipSeries cuts the line at the window edges", () => {
  const pts = [[0, 0], [10, 100], [20, 0]];
  assert.deepEqual(clipSeries(pts, 5, 15), [[5, 50], [10, 100], [15, 50]]);
  assert.deepEqual(clipSeries(pts, 0, 20), pts);
  assert.deepEqual(clipSeries(pts, 2, 4), [[2, 20], [4, 40]]);   // one segment spans the whole window
  assert.deepEqual(clipSeries(pts, 30, 40), []);
  assert.deepEqual(clipSeries([], 0, 1), []);
});
test("shiftSeries slides an older day forward, then clips", () => {
  assert.deepEqual(shiftSeries([[0, 1], [10, 2]], 100, 100, 105), [[100, 1], [105, 1.5]]);
  assert.deepEqual(shiftSeries(undefined, 100, 0, 1), []);
});
test("zoomRange: drags either way, clicks do nothing, tiny spans widen", () => {
  assert.deepEqual(zoomRange(0, 1000, .2, .4), [200, 400]);
  assert.deepEqual(zoomRange(0, 1000, .4, .2), [200, 400]);
  assert.deepEqual(zoomRange(0, 1000, -1, 2), [0, 1000]);
  assert.equal(zoomRange(0, 1000, .5, .505), null);
  assert.deepEqual(zoomRange(0, 1000, .5, .53), [500, 500 + MIN_ZOOM]);
});
test("toCsv: local 12-hour time, one column per series, quoted names, gaps empty", () => {
  const t = new Date(2026, 10, 18, 15, 5, 7).getTime() / 1000;
  const csv = toCsv([{ name: "CPU", pts: [[t, 12.5]] }, { name: 'Say "hi", ok', pts: [[t + 60, 3]] }]).split("\r\n");
  assert.equal(csv[0], 'Time,CPU,"Say ""hi"", ok"');
  assert.equal(csv[1], "2026-11-18 3:05:07 PM,12.5,");
  assert.match(csv[2], /^2026-11-18 3:06:07 PM,,3$/);
  assert.equal(csv.length, 4);
});
test("fileName and shade", () => {
  assert.equal(fileName("CPU temp", "png"), "cpu-temp.png");
  assert.match(shade("#4ade80", 0), /^hsl\(\d+ \d+% \d+%\)$/);
  assert.notEqual(shade("#4ade80", 1), shade("#4ade80", 2));
  assert.match(shade("#808080", 0), /^hsl\(0 0%/);
  for (const c of ["#ff0000", "#00ff00", "#0000ff"]) assert.match(shade(c, 3), /^hsl\(/);
});
