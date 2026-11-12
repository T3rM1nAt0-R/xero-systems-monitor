import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handle, COMMANDS, checkMachines } from "../src/fakeBackend.js";
import * as api from "../src/api.js";

const docs = readFileSync(new URL("../../docs/window-api.md", import.meta.url), "utf8");
const num = v => typeof v === "number" && Number.isFinite(v);
const pair = p => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]);
const NOW = Date.now() / 1000;

test("docs/window-api.md and the fake backend list the same commands", () => {
  const documented = [...docs.matchAll(/^\| `([a-z_]+)` \|/gm)].map(m => m[1]).sort();
  assert.ok(documented.length > 15);
  assert.deepEqual([...COMMANDS].sort(), documented);
});
test("api.js outside Tauri answers from the fake backend", async () => {
  const s = await api.getState();
  assert.deepEqual(s.machines.map(m => m.name), ["This PC", "example-server"]);
  assert.equal(await api.windowMode("mini"), "mini"); assert.equal(await api.windowMode("full"), "full");
  assert.equal(typeof api.onShellEvent("pinned", () => {}), "function");
  await assert.rejects(handle("no_such_command"), /unknown command/);
});
test("get_state: two machines in the documented shape", async () => {
  const { machines } = await handle("get_state");
  assert.equal(machines.length, 2);
  for (const m of machines) {
    assert.equal(typeof m.name, "string"); assert.equal(m.err, null); assert.ok(num(m.t));
    assert.equal(typeof m.started, "object"); assert.ok(Array.isArray(m.gone)); assert.ok(Array.isArray(m.cgone));
    for (const k of ["cpu", "temp", "ram", "disk", "down", "up", "ping", "uptime", "speed"]) assert.ok(num(m.d[k]), k);
    assert.equal(typeof m.d.ip, "string"); assert.equal(m.d.ram_gb.length, 2);
    for (const [n, used, total] of m.d.storage) assert.ok(typeof n === "string" && num(used) && num(total));
    for (const [n, c, r, k] of m.d.top) assert.ok(typeof n === "string" && num(c) && num(r) && num(k));
  }
  const [pc, server] = machines;
  assert.ok(num(pc.d.gpu) && pc.d.vram_gb.length === 2 && pc.d.runners === undefined);
  assert.deepEqual(Object.keys(server.d.runners), ["runner-1", "runner-2"]);
  assert.equal(server.d.gpu, undefined);
  for (const [r, j] of Object.entries(server.d.jobs)) { assert.ok(r in server.d.runners && server.d.runners[r] && num(server.started[r])); assert.equal(j.length, 4); }
  for (const c of server.d.docker) assert.equal(c.length, 6);
});
test("get_history: [t, value] points, oldest first, a series the machine lacks is empty", async () => {
  for (const range of [300, 86400, 31536000]) {
    const h = await handle("get_history", { machine: "This PC", range });
    for (const k of ["cpu", "ram", "disk", "temp", "gpu", "vram", "gtemp", "down", "up", "ping"]) {
      assert.ok(h[k].length > 1 && h[k].length <= 401, `${k} ${range}`); assert.ok(h[k].every(pair));
      assert.ok(h[k].every((p, i) => i === 0 || p[0] >= h[k][i - 1][0]));
    }
    assert.ok(num(h.loss));
  }
  const s = await handle("get_history", { machine: "example-server", range: 3600 });
  assert.deepEqual(s.gpu, []); assert.ok(s.cpu.length > 1);
  assert.deepEqual(await handle("get_history", { machine: "nobody", range: 300 }), {});
});
test("get_events and get_jobs: rows of the documented shape, in the documented order", async () => {
  const ev = await handle("get_events", { since: NOW - 86400, n: 60 });
  assert.ok(ev.length > 0 && ev.length <= 60);
  for (const [t, machine, msg] of ev) { assert.ok(num(t) && t >= NOW - 86400); assert.equal(machine, "example-server"); assert.equal(typeof msg, "string"); }
  assert.ok(ev.every((e, i) => i === 0 || e[0] <= ev[i - 1][0]));
  assert.equal((await handle("get_events", { since: 0, n: 3 })).length, 3);
  const jobs = await handle("get_jobs", { since: NOW - 14 * 86400 });
  assert.ok(jobs.length > 10);
  for (const [m, r, s, e, res, label] of jobs) { assert.equal(m, "example-server"); assert.match(r, /^runner-/); assert.ok(s < e && e <= NOW && e >= NOW - 14 * 86400); assert.ok(["Succeeded", "Failed", "Canceled"].includes(res)); assert.match(label, /^PR #/); }
  assert.ok(jobs.every((j, i) => i === 0 || j[3] >= jobs[i - 1][3]));
});
test("get_forecast: per_day and days, null when the disk is not filling", async () => {
  const s = await handle("get_forecast", { machine: "example-server" }), p = await handle("get_forecast", { machine: "This PC" });
  assert.ok(num(s.per_day) && num(s.days)); assert.deepEqual(p, { per_day: null, days: null });
});
test("machines: saved, checked, and followed by get_state", async () => {
  const { machines } = await handle("get_machines");
  assert.deepEqual(machines.map(m => m.kind), ["local", "ssh"]);
  assert.match((await handle("save_machines", { machines: [] })).error, /at least one/);
  assert.match(checkMachines([{ name: "a|b", kind: "local" }]), /no \|/);
  assert.match(checkMachines([{ name: "a", kind: "local" }, { name: "a", kind: "local" }]), /Two machines/);
  assert.match(checkMachines([{ name: "a", kind: "ssh" }]), /needs a host/);
  assert.deepEqual(await handle("save_machines", { machines: [machines[0], { name: "box", kind: "ssh", host: "192.0.2.30", was: "old" }] }), {});
  assert.deepEqual((await handle("get_state")).machines.map(m => m.name), ["This PC", "box"]);
  assert.equal((await handle("get_machines")).machines[1].was, undefined);
});
test("prefs, window and lifecycle commands", async () => {
  assert.deepEqual(Object.keys(await handle("get_prefs")).sort(), ["closeToTray", "login", "packaged"]);
  assert.equal((await handle("set_prefs", { patch: { login: true } })).login, true);
  assert.equal(await handle("set_pinned", { on: 1 }), true);
  for (const c of ["set_theme", "set_mini_height", "restart_collector", "relaunch", "stop_everything", "quit"]) assert.equal(await handle(c, {}), null);
  assert.equal(await handle("check_for_updates"), false); assert.equal(await handle("apply_update"), false);
  const v = await handle("get_version"); assert.equal(typeof v.version, "string"); assert.ok(num(v.date));
});
