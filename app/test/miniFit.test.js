import { test } from "node:test";
import assert from "node:assert/strict";
import { FIT_STEP, DRAG_HOLD_MS, wantedHeight, shouldResize, userResizing, contentHeight } from "../src/miniFit.js";
import { miniTiles, miniChip } from "../src/miniTiles.js";

test("mini fit: only a real change of at least the step is sent", () => {
  assert.equal(shouldResize(null, 200), true);
  assert.equal(shouldResize(200, 200), false);
  assert.equal(shouldResize(200, 200 + FIT_STEP - 1), false);
  assert.equal(shouldResize(200, 200 - FIT_STEP), true);
  assert.equal(shouldResize(200, NaN), false);
  assert.equal(shouldResize(200, 0), false);
  assert.equal(wantedHeight(129.2), 132);
});
test("mini fit: the person's own drag is left alone until it settles", () => {
  assert.equal(userResizing(1000, null), false);
  assert.equal(userResizing(1000 + DRAG_HOLD_MS - 1, 1000), true);
  assert.equal(userResizing(1000 + DRAG_HOLD_MS, 1000), false);
});
test("mini fit: content height counts layout rows, not the dock or dialogs", () => {
  const row = (h, ...c) => ({ offsetHeight: h, classList: { contains: k => c.includes(k) } });
  assert.equal(contentHeight([row(40), row(100), row(50, "dock"), row(9, "modal")]), 140);
});
test("mini tiles: GPU when the machine has one, network speed when not", () => {
  const pc = miniTiles({ cpu: 81.6, ram: 59, gpu: 15, temp: 54 });
  assert.deepEqual(pc.map(t => t.k), ["cpu", "ram", "gpu", "temp"]);
  assert.equal(pc[0].text, "82%");
  const srv = miniTiles({ cpu: 5, ram: 6, down: 2.5e6 });
  assert.equal(srv[2].k, "down"); assert.equal(srv[2].text, "2.5"); assert.equal(srv[2].unit, "MB/s");
  assert.equal(srv[3].text, "–");
  assert.equal(miniTiles({ down: null })[2].text, "–");
});
test("mini chip: only when something needs a look", () => {
  const ok = { name: "a", d: { cpu: 10, temp: 40 } };
  assert.equal(miniChip(ok, undefined, undefined, 0, 0), "");
  assert.equal(miniChip({ name: "a", err: "x" }, undefined, undefined, 0, 0), "Offline");
  assert.match(miniChip({ name: "a", err: "x" }, undefined, undefined, 1700000000, 0), /^Offline since /);
  assert.equal(miniChip(ok, undefined, 1, 0, 5 * 60000 + 1), "CPU high 5 min");
  assert.equal(miniChip({ d: { cpu: 99 } }, undefined, undefined, 0, 0), "CPU is high");
  assert.equal(miniChip({ d: { temp: 95 } }, undefined, undefined, 0, 0), "Running warm");
});
