import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anyCardOpen } from "../src/fold.js";

const css = f => readFileSync(new URL("../src/styles/" + f, import.meta.url), "utf8");

test("fold all label: with no machine card on screen nothing counts as open", () => assert.equal(anyCardOpen(), false));
test("hovering a card or tile never moves it (no translate, scale or transform on :hover)", () => {
  for (const f of ["statusfx.css", "card.css", "view.css", "compact.css", "mini.css", "lookfx.css", "stylefx.css", "windowfx.css"]) {
    for (const rule of css(f).split("}").filter(r => /\.(card|tile)[^{]*:hover/.test(r))) assert.doesNotMatch(rule, /translate|scale|transform/, f + ": " + rule);
  }
});
test("the window never scrolls sideways: safety net plus the grid and title-bar fixes", () => {
  assert.match(css("base.css"), /html,body\{overflow-x:hidden\}/);
  assert.match(css("motion.css"), /\.collapse\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css("motion.css"), /\.collapse-in\{[^}]*min-width:0/);
  assert.doesNotMatch(css("titlebar.css"), /\.winspace\{[^}]*margin-right:calc\(-1/);
});
test("live numbers are tabular and the status text sits in a fixed slot", () => {
  const s = css("steady.css");
  assert.match(s, /\.app\{font-variant-numeric:tabular-nums\}/);
  assert.match(s, /\.chead \.state\{flex:0 1 var\(--sz-150\)/);
  assert.match(s, /\.unusual\.none\{visibility:hidden/);
});
