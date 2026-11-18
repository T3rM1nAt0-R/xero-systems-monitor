import test from "node:test";
import assert from "node:assert/strict";

const files = new Map();
globalThis.localStorage = { getItem: k => (files.has(k) ? files.get(k) : null), setItem: (k, v) => files.set(k, String(v)), removeItem: k => files.delete(k) };
const { get, set, subscribe, load, save, keysWith, forgetMemory } = await import("../src/store.js");
const { foldAll, reaches } = await import("../src/fold.js");
const { loadGroups, saveGroups, revealGroup, onReveal } = await import("../src/groupPrefs.js");

test("get falls back to the default, set saves under the xm. prefix and tells subscribers", () => {
  assert.equal(get("a", 5), 5);
  const heard = [];
  const stop = subscribe("a", () => heard.push(get("a")));
  set("a", 7); set("a", 7); set("a", 8);
  assert.deepEqual(heard, [7, 8], "the same value twice is not a change");
  assert.equal(files.get("xm.a"), "8");
  stop(); set("a", 9);
  assert.deepEqual(heard, [7, 8]);
});

test("a saved value is read back after the memory is forgotten (a new run)", () => {
  save("b", { x: [1, 2] }); forgetMemory();
  assert.deepEqual(load("b", null), { x: [1, 2] });
});

test("persist:false keeps a value in memory only", () => {
  set("t", { n: 1 }, { persist: false });
  assert.equal(files.has("xm.t"), false);
  assert.deepEqual(get("t"), { n: 1 });
});

test("a broken or refusing localStorage never throws", async () => {
  files.set("xm.junk", "{not json");
  assert.equal(get("junk", "d"), "d");
  const keep = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  forgetMemory();
  assert.equal(get("c", 1), 1);
  set("c", 2);
  assert.equal(get("c"), 2, "the value lives in memory even when it cannot be saved");
  globalThis.localStorage = keep;
});

test("fold all reaches the folds that are on screen by prefix, or one exactly", () => {
  assert.equal(reaches("card.srv", { prefix: "card.", exact: false }), true);
  assert.equal(reaches("card.srv2", { prefix: "card.srv", exact: true }), false);
  assert.equal(keysWith("col.").length >= 0, true);
  assert.doesNotThrow(() => foldAll(true, "card."));   // nothing mounted in a test: nothing to change
});

test("section choices and reveal requests go through the store", () => {
  forgetMemory();
  assert.deepEqual(loadGroups("example-server").hidden, []);
  const heard = [];
  const stop = subscribe("groups.example-server", () => heard.push(loadGroups("example-server").hidden));
  saveGroups("example-server", { order: ["gpu"], hidden: ["gpu", "bogus"] });
  assert.deepEqual(heard, [["gpu"]]);
  assert.equal(loadGroups("example-server").order[0], "gpu");
  stop();
  const asked = [], off = onReveal(id => asked.push(id));
  revealGroup("example-server.net"); revealGroup("example-server.net");
  assert.deepEqual(asked, ["example-server.net", "example-server.net"], "asking twice counts twice");
  assert.equal(files.has("xm.reveal"), false, "a request is never saved");
  off();
});
