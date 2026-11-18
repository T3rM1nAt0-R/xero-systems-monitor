import test from "node:test";
import assert from "node:assert/strict";
import { isClick, CLICK_PX } from "../src/graphTools.js";
import { trackMachines } from "../src/calm.js";
import { memoLimitsFor, DEFAULT_LIMITS } from "../src/limits.js";

test("isClick: a barely moved pointer is a click, a drag is not", () => {
  assert.equal(isClick([10, 10], 10, 10), true);
  assert.equal(isClick([10, 10], 10 + CLICK_PX, 10), true);
  assert.equal(isClick([10, 10], 10 + CLICK_PX + 1, 10), false);
  assert.equal(isClick([0, 0], 30, 40), false);
  assert.equal(isClick(null, 500, 500), true);   // no known start: do not swallow the click
});

test("memoLimitsFor gives the same object for the same machine", () => {
  const of = memoLimitsFor({ a: { cpu: 50 } });
  assert.equal(of("a"), of("a"));
  assert.equal(of("a").cpu, 50);
  assert.deepEqual(of("b"), DEFAULT_LIMITS);
  assert.notEqual(memoLimitsFor({ a: { cpu: 50 } })("a"), of("a"));
});

const lim = () => DEFAULT_LIMITS;
const M = (name, cpu, extra = {}) => ({ name, t: 1000, d: { cpu }, ...extra });
const empty = () => ({ hot: {}, lastOk: {} });

test("trackMachines: CPU over the limit starts the clock once and keeps it", () => {
  const a = trackMachines(empty(), [M("a", 99)], 5000, lim);
  assert.equal(a.hot.a.cpu, 1000 * 1000);
  const b = trackMachines(a, [M("a", 99, { t: 1003 })], 9000, lim);
  assert.equal(b.hot.a.cpu, 1000 * 1000);
  assert.equal(b.hot.a, a.hot.a, "unchanged entry keeps its identity");
  assert.equal(trackMachines(b, [M("a", 5)], 9000, lim).hot.a.cpu, 0);
});

test("trackMachines: offline resets the clock, keeps last seen, and never changes its input", () => {
  const a = trackMachines(empty(), [M("a", 99)], 5000, lim);
  const frozen = JSON.stringify(a);
  const b = trackMachines(a, [{ name: "a", err: "down", d: null }], 6000, lim);
  assert.equal(b.hot.a.cpu, 0);
  assert.equal(b.lastOk.a, 1000);
  assert.equal(JSON.stringify(a), frozen);
  assert.deepEqual(trackMachines(a, [M("a", 99)], 5000, lim), trackMachines(a, [M("a", 99)], 5000, lim), "same input, same answer");
});

test("trackMachines: without a snapshot time the clock starts at now", () => {
  const r = trackMachines(empty(), [{ name: "a", d: { cpu: 99 } }], 7000, lim);
  assert.equal(r.hot.a.cpu, 7000);
  assert.equal(r.lastOk.a, 7);
});
