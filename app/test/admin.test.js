import test from "node:test";
import assert from "node:assert/strict";
import { adminRows, moreAdminRows, asAdmin, SUDO_HINT } from "../src/admin.js";
import { emptyTerms, addTerm } from "../src/terminal.js";
import { handle } from "../src/fakeBackend.js";

const ids = rows => rows.map(r => r.id);
test("Admin shell menu: rows for each state", () => {
  assert.deepEqual(adminRows({ elevated: true, sudo: "inline" }), []);
  assert.deepEqual(ids(adminRows({ elevated: false, sudo: "inline" })), ["tab", "window", "restart"]);
  assert.ok(!adminRows({ elevated: false, sudo: "inline" })[0].disabled);
  const off = adminRows({ elevated: false, sudo: "not_inline" });
  assert.deepEqual(ids(off), ["tab", "window", "restart"]);
  assert.ok(off[0].disabled); assert.equal(off[0].hint, SUDO_HINT);
  assert.deepEqual(ids(adminRows({ elevated: false, sudo: "missing" })), ["window", "restart"]);
});
test("More menu rows: restart button and the always tick", () => {
  const [btn, tick] = moreAdminRows({ elevated: false, alwaysAdmin: false });
  assert.deepEqual([btn.label, btn.disabled, tick.on], ["Restart as admin", false, false]);
  const [ran, on] = moreAdminRows({ elevated: true, alwaysAdmin: true });
  assert.deepEqual([ran.label, ran.disabled, on.on], ["Running as admin", true, true]);
});
test("a cancelled Windows question is a quiet toast", async () => {
  const said = [];
  await asAdmin(() => Promise.reject("Cancelled"), t => said.push(t));
  await asAdmin(() => Promise.reject(new Error("boom")), t => said.push(t));
  await asAdmin(() => Promise.resolve(), t => said.push(t));
  assert.deepEqual(said, ["Cancelled", "boom"]);
});
test("an admin tab remembers it was started as admin", () => {
  const t = addTerm(addTerm(emptyTerms(), "This PC", 1), "This PC", 2, true);
  assert.deepEqual(t.items.map(s => !!s.admin), [false, true]);
});
test("demo backend: not elevated, sudo not inline", async () => {
  assert.equal(await handle("is_elevated"), false);
  assert.equal(await handle("sudo_inline_available"), "not_inline");
  assert.equal(await handle("open_admin_shell_window"), null);
});
