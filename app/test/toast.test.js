import test from "node:test";
import assert from "node:assert/strict";
import { toast, dismiss, toastsNow, MAX_TOASTS, TOAST_MS } from "../src/toast.js";

test("toasts stack, keep only the newest few, and go away by themselves or when dismissed", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const a = toast("Saved picture");
  assert.deepEqual(toastsNow().map(x => x.text), ["Saved picture"]);
  for (let i = 0; i < MAX_TOASTS + 1; i++) toast("Copied " + i);
  assert.equal(toastsNow().length, MAX_TOASTS);
  assert.ok(!toastsNow().some(x => x.id === a), "the oldest was pushed out");
  dismiss(toastsNow()[0].id);
  assert.equal(toastsNow().length, MAX_TOASTS - 1);
  dismiss(99999);
  t.mock.timers.tick(TOAST_MS + 1);
  assert.equal(toastsNow().length, 0);
});
