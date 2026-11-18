import test from "node:test";
import assert from "node:assert/strict";
import { isWarn, LIM } from "../src/format.js";
import { DEFAULT_LIMITS, cleanLimit, limitsFor, setLimit, tidyLimits } from "../src/limits.js";
import { DEFAULT_QUIET, isQuiet, isHeld, isMuted, mute, unmute, muteLabel, timeLabel, TIME_OPTIONS } from "../src/quiet.js";
import { machineAlerts, diskAlerts, failedAlerts, eventAlerts } from "../src/alerts.js";

test("defaults are today's limits", () => {
  assert.deepEqual(DEFAULT_LIMITS, { cpu: LIM.cpu, temp: LIM.temp, gtemp: LIM.gtemp, disk: 90, days: 14 });
});
test("isWarn: the old two-argument form still works, an own limit wins", () => {
  assert.equal(isWarn("cpu", 85), false);
  assert.equal(isWarn("cpu", 85, { cpu: 80 }), true);
  assert.equal(isWarn("cpu", 85, { temp: 50 }), false);   // no cpu limit given: the standard one
  assert.equal(isWarn("ram", 99, { cpu: 1 }), true);
  assert.equal(isWarn("nope", 99, {}), false);
});
test("limits: saved values over defaults, bad values ignored", () => {
  assert.deepEqual(limitsFor({}, "a"), DEFAULT_LIMITS);
  assert.deepEqual(limitsFor(undefined, "a"), DEFAULT_LIMITS);
  assert.equal(limitsFor({ a: { cpu: 70, temp: "abc", gtemp: 500, disk: "", days: 30 } }, "a").cpu, 70);
  const l = limitsFor({ a: { cpu: 70, temp: "abc", gtemp: 500, disk: "", days: 30 } }, "a");
  assert.deepEqual([l.temp, l.gtemp, l.disk, l.days], [80, 80, 90, 30]);
  assert.equal(cleanLimit("nope", 5), undefined);
  assert.equal(cleanLimit("cpu", 0), 90);
});
test("limits: same for all, one machine, and tidy saves only changes", () => {
  const all = setLimit({}, ["a", "b"], null, "cpu", "75");
  assert.equal(limitsFor(all, "b").cpu, 75);
  const one = setLimit(all, ["a", "b"], "a", "disk", "");
  assert.equal(limitsFor(one, "a").disk, 90);
  assert.deepEqual(tidyLimits(one), { a: { cpu: 75 }, b: { cpu: 75 } });
  assert.deepEqual(tidyLimits({ a: { cpu: 90 } }), {});
  assert.deepEqual(tidyLimits(undefined), {});
});
test("disk alerts follow the machine's limits", () => {
  const m = { name: "a", err: null, d: { storage: [["C:", 80, 100]] } };
  assert.equal(diskAlerts([m], {}, 0).length, 0);
  assert.equal(diskAlerts([m], {}, 0, { a: { disk: 70 } })[0].kind, "disk");
  assert.equal(diskAlerts([m], { a: { days: 20 } }, 0).length, 0);
  assert.equal(diskAlerts([m], { a: { days: 20 } }, 0, { a: { days: 30 } })[0].machine, "a");
});
test("alerts carry the machine name", () => {
  const first = machineAlerts(null, [{ name: "a", gone: [] }]);
  assert.equal(machineAlerts(first.next, [{ name: "a", err: "x", gone: [] }]).alerts[0].machine, "a");
  assert.equal(failedAlerts([["m", "r", 0, 5, "Failed", "x"]], 1).alerts[0].machine, "m");
  assert.equal(eventAlerts([[5, "m", "web keeps restarting (x)"]], 1).alerts[0].machine, "m");
});

const at = (h, m) => new Date(2026, 0, 5, h, m);
test("quiet hours: 11 PM to 8 AM crosses midnight", () => {
  const q = { ...DEFAULT_QUIET, on: true };
  assert.equal(isQuiet(q, at(23, 0)), true); assert.equal(isQuiet(q, at(2, 30)), true); assert.equal(isQuiet(q, at(7, 59)), true);
  assert.equal(isQuiet(q, at(8, 0)), false); assert.equal(isQuiet(q, at(12, 0)), false); assert.equal(isQuiet(q, at(22, 59)), false);
});
test("quiet hours: same-day window, off, empty and odd settings", () => {
  const day = { on: true, from: "09:00", to: "17:00" };
  assert.equal(isQuiet(day, at(10, 0)), true); assert.equal(isQuiet(day, at(18, 0)), false);
  assert.equal(isQuiet({ ...day, on: false }, at(10, 0)), false);
  assert.equal(isQuiet({ on: true, from: "09:00", to: "09:00" }, at(9, 0)), false);
  assert.equal(isQuiet({ on: true, from: "bad", to: "09:00" }, at(9, 0)), false);
  assert.equal(isQuiet(undefined, at(9, 0)), false);
  assert.equal(isQuiet(day), isQuiet(day, new Date()));
});
test("quiet hours hold everything except offline", () => {
  const q = { ...DEFAULT_QUIET, on: true };
  assert.equal(isHeld(q, "hot", at(1, 0)), true); assert.equal(isHeld(q, "offline", at(1, 0)), false); assert.equal(isHeld(q, "hot", at(12, 0)), false);
  assert.equal(typeof isHeld(q, "hot"), "boolean");
});
test("times read 12-hour", () => {
  assert.equal(timeLabel("23:00"), "11:00 PM"); assert.equal(timeLabel("00:30"), "12:30 AM"); assert.equal(timeLabel("12:00"), "12:00 PM"); assert.equal(timeLabel("x"), "");
  assert.equal(TIME_OPTIONS.length, 48); assert.deepEqual(TIME_OPTIONS[16], ["08:00", "8:00 AM"]);
});
test("mute: per machine and kind, unmute undoes it", () => {
  let l = mute(undefined, "a", "hot"); l = mute(l, "a", "hot"); l = mute(l, "b", "disk");
  assert.equal(l.length, 2); assert.equal(isMuted(l, "a", "hot"), true); assert.equal(isMuted(l, "b", "hot"), false); assert.equal(isMuted(undefined, "a", "hot"), false);
  assert.deepEqual(unmute(l, "a", "hot"), [{ machine: "b", kind: "disk" }]); assert.deepEqual(unmute(undefined, "a", "hot"), []);
  assert.equal(muteLabel({ machine: "a", kind: "hot" }), "CPU high · a"); assert.equal(muteLabel({ machine: "a", kind: "zzz" }), "zzz · a");
});
