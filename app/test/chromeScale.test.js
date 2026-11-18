import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// The window's own chrome keeps one fixed size: the scaled tokens are declared again where --scale and --dens are 1.
const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
test("chrome (panel, menus, dialogs, Ctrl+K, toasts, top bar) re-declares the scaled tokens at scale 1 and density 1", () => {
  const head = css.match(/:root, ([^{]+) \{\s*\/\* font sizes/)?.[1] || "", fixed = css.match(/\n([^\n{]+) \{ --scale: 1; --dens: 1; \}/)?.[1] || "";
  assert.equal(head, fixed, "the same selectors get the tokens and the fixed scale");
  for (const s of [".cpanel", ".menu", ".modal", ".toasts", ".xmtip", ".top"]) assert.ok(fixed.split(", ").includes(s), s);
  assert.ok(css.indexOf("--sp-8") > css.indexOf(head), "spacing tokens are in the shared block");
});
