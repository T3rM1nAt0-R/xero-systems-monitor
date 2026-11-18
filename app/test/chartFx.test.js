import test from "node:test";
import assert from "node:assert/strict";
import { fxKind, heatStops, peakOf, newest, rollDir, nearStyle } from "../src/chartFx.js";
import { countText, startupBegin, isStartup, STARTUP_MS } from "../src/startup.js";
import { motionLevel, motionFull, motionMs, MOTION_MS } from "../src/motion.js";

test("graph motion: first draw, slide, stretch on a range change, nothing otherwise", () => {
  const was = { t0: 0, t1: 300, ready: true };
  assert.equal(fxKind(null, { t0: 0, t1: 300, ready: false }), "");
  assert.equal(fxKind(null, { t0: 0, t1: 300, ready: true }), "first");
  assert.equal(fxKind({ ...was, ready: false }, { t0: 0, t1: 300, ready: true }), "first");
  assert.equal(fxKind(was, { t0: 3, t1: 303, ready: true }), "slide");
  assert.equal(fxKind(was, { t0: 0, t1: 300, ready: true }), "");
  assert.equal(fxKind(was, { t0: -3300, t1: 300, ready: true }), "stretch");
  assert.equal(fxKind(was, { t0: 200, t1: 500, ready: true }), "", "a long sleep just redraws");
  assert.equal(fxKind({ t0: 5, t1: 5, ready: true }, { t0: 5, t1: 8, ready: true }), "");
});

test("heat stops: own colour, warming toward the limit, red above it", () => {
  assert.deepEqual(heatStops(90, 100), [[0, "own"], [0.54, "own"], [0.9, "warn"], [0.9, "bad"], [1, "bad"]]);
  assert.equal(heatStops(150, 100), null);
  assert.equal(heatStops(0, 100), null);
});

test("peak and newest points inside the window", () => {
  const a = [[1, 5], [2, 9], [3, 4]], b = [[2, 12], [9, 99]];
  assert.deepEqual(peakOf([a, b], 0, 5), { t: 2, v: 12, i: 1 });
  assert.equal(peakOf([[]], 0, 5), null);
  assert.deepEqual(newest(a, 0, 5), { t: 3, v: 4 });
  assert.deepEqual(newest(a, 0, 2.5), { t: 2, v: 9 });
  assert.equal(newest(a, 3.5, 5), null);
  assert.equal(newest([], 0, 5), null);
});

test("a number rolls up when it grows and down when it shrinks", () => {
  assert.equal(rollDir("10", "20"), 1);
  assert.equal(rollDir("20", "10"), -1);
  assert.equal(rollDir("4.5 KB/s", "4.1 KB/s"), -1);
  assert.equal(rollDir("–", "5"), 1);
  assert.equal(rollDir(null, "5"), 1);
});

test("the Motion setting: system reduced motion wins; Off and Subtle are read from the page", () => {
  assert.equal(motionLevel(false, undefined), "full");
  assert.equal(motionLevel(false, "subtle"), "subtle");
  assert.equal(motionLevel(false, "off"), "off");
  assert.equal(motionLevel(true, "full"), "off");
  assert.equal(motionFull("full"), true); assert.equal(motionFull("subtle"), false);
  assert.equal(motionMs(false, "off"), 0); assert.equal(motionMs(false, "subtle"), MOTION_MS); assert.equal(motionMs(true), 0);
});

test("a big number turns amber from 70% of its limit and red from the limit", () => {
  assert.deepEqual(nearStyle(50, 100), { "--amber": "0%", "--red": "0%" });
  assert.deepEqual(nearStyle(85, 100), { "--amber": "50%", "--red": "0%" });
  assert.deepEqual(nearStyle(100, 100), { "--amber": "100%", "--red": "0%" });
  assert.deepEqual(nearStyle(105, 100), { "--amber": "100%", "--red": "50%" });
  assert.deepEqual(nearStyle(150, 100), { "--amber": "100%", "--red": "100%" });
  assert.equal(nearStyle(NaN, 100), null);
  assert.equal(nearStyle(5, 0), null);
});

test("startup: numbers count up from zero and the startup moment ends", () => {
  assert.equal(countText("80", 0), "0");
  assert.equal(countText("80", 1), "80");
  assert.equal(countText("4.1 GB", 1), "4.1 GB");
  assert.equal(countText("4.0 GB", 0), "0.0 GB");
  assert.equal(countText("n/a", 0.5), "n/a");
  assert.equal(countText(null, 0.5), null);
  assert.ok(countText("100", 0.5) > 50 && countText("100", 0.5) < 100, "eases out: past halfway at half time");
  startupBegin(1000);
  assert.equal(isStartup(1000 + STARTUP_MS - 1), true);
  assert.equal(isStartup(1000 + STARTUP_MS), false);
});
