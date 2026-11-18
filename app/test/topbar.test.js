import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// The top bar must never wrap and the window buttons stay in the real top-right corner, above the Customize panel (checked in a browser at 900px with Customize open).
const css = readFileSync(new URL("../src/styles/titlebar.css", import.meta.url), "utf8");
test("top bar never wraps and the window buttons are pinned to the corner", () => {
  assert.match(css, /\.top\{flex-wrap:nowrap/);
  assert.match(css, /\.winbtns\{position:fixed;top:0;right:0;z-index:40/);
  assert.match(css, /html\[data-panel="open"\] \.top \.clock\{display:none\}/);
  const panel = readFileSync(new URL("../src/styles/customize.css", import.meta.url), "utf8");
  assert.match(panel, /\.cpanel\{position:fixed;top:var\(--sz-38\)/);
});
