import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/fakeBackend.js";
import { speedText, adapterRows, wifiBars, latencyClass, msText, internetNow, stripCells, uptimeText, pingRows, hostOk } from "../src/network.js";

test("adapters: connected first, speeds in plain units", () => {
  assert.equal(speedText(1000), "1 Gbps");
  assert.equal(speedText(866), "866 Mbps");
  assert.equal(speedText(null), "");
  const rows = adapterRows({ adapters: [["VPN", false, null, null], ["Wi-Fi", true, 866, "192.0.2.21"], ["Ethernet", true, 1000, "192.0.2.20"]] });
  assert.deepEqual(rows.map(r => r.name), ["Ethernet", "Wi-Fi", "VPN"]);
  assert.equal(rows[2].ip, "");
  assert.deepEqual(adapterRows({}), []);
  assert.deepEqual([10, 30, 60, 90].map(wifiBars), [1, 2, 3, 4]);
});

test("delays get a colour class and plain text", () => {
  assert.deepEqual([null, 20, 100, 300].map(latencyClass), ["down", "ok", "slow", "bad"]);
  assert.equal(msText(null), "no answer");
  assert.equal(msText(3.44), "3.4 ms");
  assert.equal(msText(41.6), "42 ms");
  assert.equal(internetNow({}), null);
  assert.deepEqual(internetNow({ inet: [true, 12, 40] }), { up: true, dns: 12, ms: 40 });
});

test("the 24 hour strip", () => {
  const now = 1_800_000_450;
  const cells = stripCells([[now - 10, 1], [now - 20, 1], [now - 1000, 0], [now - 2000, 1], [now - 2010, 0], [now - 99999, 1]], now);
  assert.equal(cells.length, 96);
  assert.equal(cells[95].state, "up");
  assert.equal(cells[94].state, "down");
  assert.equal(cells[93].state, "part");
  assert.equal(cells[0].state, "none");
  assert.equal(uptimeText(cells), "33%");
  assert.equal(uptimeText(stripCells([], now)), "");
  assert.equal(stripCells(undefined, now).length, 96);
});

test("ping rows: slowest answers first, silent machines last", () => {
  const rows = pingRows({ pings: [["a", 3], ["b", null], ["c", 240]] });
  assert.deepEqual(rows.map(r => r.name), ["c", "a", "b"]);
  assert.equal(rows[0].cls, "slow");
  assert.equal(rows[2].text, "no answer");
  assert.deepEqual(pingRows({}), []);
});

test("only plain https addresses are accepted", () => {
  assert.ok(hostOk("https://example.com/ok"));
  for (const bad of ["http://example.com", "", "https://a b", undefined]) assert.ok(!hostOk(bad));
});

test("the demo backend carries the network facts and accepts the check address", async () => {
  const { machines } = await handle("get_state");
  const pc = machines.find(m => m.name === "This PC"), srv = machines.find(m => m.name === "example-server");
  assert.ok(pc.d.adapters.length === 3 && pc.d.wifi[1] > 0 && pc.d.inet[0] === true && pc.d.pings.length === 3);
  assert.equal(srv.d.adapters.length, 1);
  assert.equal(srv.d.pings, undefined);
  const h = await handle("get_history", { machine: "This PC", range: 86400 });
  assert.ok(h.extra.inet.some(p => p[1] === 0) && h.extra["pm:example-nas"].length > 5);
  assert.equal(await handle("set_internet_host", { url: "https://example.com" }), null);
  assert.equal(await handle("set_internet_host", { url: "nonsense" }), null);
});
