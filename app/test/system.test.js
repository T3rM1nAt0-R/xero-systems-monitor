import test from "node:test";
import assert from "node:assert/strict";
import { parseJournal, parseEvents, parseLog, searchLog, logTime } from "../src/logs.js";
import { handle } from "../src/fakeBackend.js";
import { parseUnits, parseWinServices, parseServices, parseUpdates, countStates, filterServices, passwordCommand, UPDATES_EVERY_MS } from "../src/system.js";

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

test("logs: journalctl lines and Windows events parse, newest first, 12-hour times", async () => {
  const j = parseJournal("-- Boot abc --\n2026-11-18T09:12:01+0000 example-server ssh[812]: Accepted key\n2026-11-18T21:30:00+00:00 example-server cron: ran\n");
  assert.deepEqual(j.map(r => [r.unit, r.msg]), [["cron", "ran"], ["ssh", "Accepted key"]]);
  assert.equal(j[1].t, Date.parse("2026-11-18T09:12:01Z"));
  const w = parseEvents('[{"Time":"2026-11-18T09:00:00.0000000+00:00","ProviderName":"Disk","Level":"Error","Message":"bad block"},{"Time":"2026-11-18T10:00:00.0000000+00:00","LogName":"System","Level":"Warning","Message":"slow"},{"x":1}]');
  assert.deepEqual(w.map(r => [r.unit, r.level]), [["System", "warning"], ["Disk", "error"]]);
  assert.deepEqual(parseEvents("nope"), []);
  assert.deepEqual(parseEvents("null"), []);
  assert.equal(parseLog('[{"Time":"2026-11-18T09:00:00Z","Message":"m"}]').length, 1);
  assert.equal(parseLog(null).length, 0);
  assert.match(logTime(Date.UTC(2026, 10, 18, 21, 5, 7)), /(AM|PM)$/);
  assert.equal(searchLog(j, "ssh key").length, 1);
  assert.equal(searchLog(j, "").length, 2);
  assert.equal(searchLog(j, "nothing here").length, 0);
});
test("demo backend: logs follow the priority and unit filters, for both machines", async () => {
  const lines = async (machine, priority, unit) => parseLog(await handle("system_logs", { machine, priority, unit }));
  const all = await lines("example-server", "all"), warn = await lines("example-server", "warnings"), err = await lines("example-server", "errors");
  assert.ok(all.length > warn.length && warn.length > err.length && err.length > 0);
  assert.ok((await lines("example-server", "all", "ssh.service")).every(r => r.unit === "ssh"));
  assert.ok((await lines("This PC", "errors")).every(r => r.level === "error"));
  assert.ok((await lines("This PC", "all")).length > 0);
  await assert.rejects(async () => handle("system_logs", { machine: "nope", priority: "all" }), /not in the list/);
  await assert.rejects(async () => handle("system_logs", { machine: "This PC", priority: "x" }), /Not a priority/);
  await assert.rejects(async () => handle("system_logs", { machine: "This PC", priority: "all", unit: "a b" }), /service name/);
});
