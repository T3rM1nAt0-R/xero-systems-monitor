import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";

test("This PC's demo reading has connections per program, most first, at most 8; the server has none", async () => {
  const { machines } = await handle("get_state");
  const [pc, server] = machines;
  assert.ok(pc.d.conns.length > 1 && pc.d.conns.length <= 8);
  for (const [name, n] of pc.d.conns) assert.ok(typeof name === "string" && Number.isInteger(n) && n > 0);
  assert.deepEqual(pc.d.conns.map(c => c[1]), pc.d.conns.map(c => c[1]).sort((a, b) => b - a));
  assert.equal(server.d.conns, undefined);
});
