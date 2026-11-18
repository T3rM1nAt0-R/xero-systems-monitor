import test from "node:test";
import assert from "node:assert/strict";
import { emptyTerms, addTerm, closeTerm, pickTerm, sessionId, validSessionId, sessionTitle, xtermLook, fontSizeFor, MAX_SESSIONS } from "../src/terminal.js";
import { run, createShell, PROMPT } from "../src/fakeShell.js";
import { handle } from "../src/fakeBackend.js";
import * as api from "../src/api.js";

test("session ids are plain and accepted by the shell side", () => {
  const id = sessionId("This PC / dev", 3);
  assert.equal(id, "t3-This_PC_dev");
  assert.ok(validSessionId(id));
  assert.ok(validSessionId(sessionId("x".repeat(200), 99)));
  for (const bad of ["", "a b", "a/b", "x".repeat(65)]) assert.ok(!validSessionId(bad));
});
test("sub-tabs: add, pick, close, limit", () => {
  let t = emptyTerms();
  t = addTerm(t, "A", 1); t = addTerm(t, "A", 2); t = addTerm(t, "A", 3);
  assert.deepEqual(t.items.map(sessionTitle), ["Shell 1", "Shell 2", "Shell 3"]);
  assert.equal(t.active, t.items[2].id);
  t = pickTerm(t, t.items[0].id); assert.equal(t.active, t.items[0].id);
  assert.equal(pickTerm(t, "nope"), t);
  const mid = t.items[1].id;
  assert.equal(closeTerm(t, mid).active, t.items[0].id);
  t = pickTerm(t, mid); t = closeTerm(t, mid);
  assert.equal(t.active, t.items[0].id);                   // neighbour on the left takes over
  assert.equal(closeTerm(t, "nope"), t);
  t = closeTerm(t, t.items[0].id); t = closeTerm(t, t.items[0].id);
  assert.equal(t.active, null); assert.equal(t.next, 4);
  let full = emptyTerms(); for (let i = 1; i <= MAX_SESSIONS + 2; i++) full = addTerm(full, "A", i);
  assert.equal(full.items.length, MAX_SESSIONS);
});
test("xterm look comes from the tokens, with fallbacks", () => {
  const o = xtermLook(n => ({ "--bg": "#101010", "--font-mono": "Fira Code, monospace", "--scale": "1.16" })[n] || "");
  assert.equal(o.theme.background, "#101010"); assert.equal(o.fontFamily, "Fira Code, monospace"); assert.equal(o.fontSize, 15);
  assert.ok(xtermLook(() => "").theme.foreground);
  assert.equal(fontSizeFor("x"), 13);
});
test("demo shell answers help, uptime, ls and refuses the rest politely", () => {
  assert.match(run("help")[0], /Demo shell/);
  assert.match(run("uptime")[0], /up 12 days/);
  assert.match(run("ls")[0], /notes\.txt/);
  assert.deepEqual(run("echo hi there"), ["hi there"]);
  assert.deepEqual(run("  "), []);
  assert.deepEqual(run("clear"), ["\f"]);
  assert.match(run("rm -rf /")[0], /command not found/);
});
test("demo shell edits a line, runs it and prompts again", () => {
  let out = ""; const sh = createShell("example-server", t => { out += t; });
  sh.start(); sh.input("lsx\x7f\r"); sh.input("clear\r");
  assert.match(out, /notes\.txt/); assert.ok(out.includes(PROMPT("example-server"))); assert.ok(out.includes("\x1b[2J"));
});
test("terminal commands in the fake backend: open, echo through events, close", async () => {
  const got = []; const off = api.onShellEvent("terminal-output", e => got.push(e));
  await api.terminalOpen("t1-example-server", "example-server", 80, 24);
  await assert.rejects(api.terminalOpen("t1-example-server", "example-server", 80, 24), /Cannot open/);
  await assert.rejects(api.terminalOpen("bad id", "example-server", 80, 24), /Cannot open/);
  await assert.rejects(api.terminalOpen("t2-x", "nobody", 80, 24), /Cannot open/);
  await new Promise(r => setTimeout(r, 800));
  await api.terminalWrite("t1-example-server", "uptime\r");
  assert.ok(got.some(e => e.id === "t1-example-server" && e.data.includes("up 12 days")));
  assert.equal(await api.terminalResize("t1-example-server", 100, 30), null);
  assert.equal(await api.terminalClose("t1-example-server"), null);
  off(); await handle("terminal_write", { id: "gone", data: "x" });
});
