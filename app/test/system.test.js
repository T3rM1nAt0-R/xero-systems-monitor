import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";
import { parseUnits, parseWinServices, parseServices, parseUpdates, countStates, filterServices, passwordCommand, HOLD_MS, UPDATES_EVERY_MS } from "../src/system.js";

const UNITS = `ssh.service loaded active running OpenBSD Secure Shell server
● backup.service loaded failed failed Nightly backup
cups.service loaded inactive dead CUPS Scheduler
ghost.service not-found inactive dead ghost.service
user@1000.service loaded active running User Manager
not a unit line
`;
test("parseUnits: failed first, then running, then stopped; drops not-found and junk", () => {
  const l = parseUnits(UNITS);
  assert.deepEqual(l.map(s => [s.name, s.state]), [["backup.service", "failed"], ["ssh.service", "active"], ["user@1000.service", "active"], ["cups.service", "inactive"]]);
  assert.equal(l[1].desc, "OpenBSD Secure Shell server");
  assert.deepEqual(parseUnits(""), []);
  assert.deepEqual(parseUnits(null), []);
});
test("parseWinServices reads one object or a list, and bad JSON gives nothing", () => {
  const one = parseWinServices('{"Name":"Spooler","DisplayName":"Print Spooler","Status":"Running","StartType":"Automatic"}');
  assert.deepEqual(one.map(s => [s.name, s.state, s.start]), [["Spooler", "active", "Automatic"]]);
  const many = parseWinServices('[{"Name":"B","Status":"Stopped"},{"Name":"A","Status":"Running"},{"Status":"x"}]');
  assert.deepEqual(many.map(s => s.name), ["A", "B"]);
  assert.deepEqual(parseWinServices("nope"), []);
  assert.deepEqual(parseWinServices("null"), []);
});
test("parseServices picks the reader by the shape of the text", () => {
  assert.equal(parseServices(UNITS).length, 4);
  assert.equal(parseServices('[{"Name":"A","Status":"Running"}]').length, 1);
});
test("parseUpdates, counts and filters", () => {
  assert.deepEqual(parseUpdates("apt 3\n"), { manager: "apt", count: 3 });
  assert.deepEqual(parseUpdates("dnf 0"), { manager: "dnf", count: 0 });
  assert.equal(parseUpdates("none"), null);
  assert.equal(parseUpdates(undefined), null);
  const l = parseUnits(UNITS);
  assert.deepEqual(countStates(l), { active: 2, failed: 1, inactive: 1 });
  assert.equal(filterServices(l, "all").length, 4);
  assert.deepEqual(filterServices(l, "failed").map(s => s.name), ["backup.service"]);
});
test("passwordCommand finds the command to copy, from an error or a string", () => {
  assert.equal(passwordCommand("needs-password:sudo systemctl restart ssh.service"), "sudo systemctl restart ssh.service");
  assert.equal(passwordCommand(new Error("needs-password:sudo reboot")), "sudo reboot");
  assert.equal(passwordCommand("boom"), null);
  assert.equal(passwordCommand(undefined), null);
  assert.equal(HOLD_MS, 800);
  assert.equal(UPDATES_EVERY_MS, 1800000);
});
test("demo backend: services and updates for both machines, actions, bad input", async () => {
  assert.equal(parseServices(await handle("system_query", { machine: "example-server", query: "services" })).filter(s => s.state === "failed").length, 1);
  assert.ok(parseServices(await handle("system_query", { machine: "This PC", query: "services" })).every(s => s.start));
  assert.equal(parseUpdates(await handle("system_query", { machine: "example-server", query: "updates" })).count, 7);
  await assert.rejects(async () => handle("system_query", { machine: "This PC", query: "updates" }), /only checked on Linux/);
  await assert.rejects(async () => handle("system_query", { machine: "nope", query: "services" }), /not in the list/);
  await assert.rejects(async () => handle("system_query", { machine: "This PC", query: "x" }), /Not a query/);
  assert.match(await handle("system_action", { machine: "example-server", act: "restart", name: "ssh.service" }), /^Restarted ssh.service/);
  assert.match(await handle("system_action", { machine: "example-server", act: "upgrade" }), /^Installed/);
  assert.match(await handle("system_action", { machine: "example-server", act: "reboot" }), /^Restarting/);
  await assert.rejects(async () => handle("system_action", { act: "stop", name: "a; rm" }), /service name/);
  await assert.rejects(async () => handle("system_action", { act: "nuke" }), /Not an action/);
});
