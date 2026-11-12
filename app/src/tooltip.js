// The one tooltip for the whole app. It is a single element on <body>, above everything, so no card, scroll box or
// clipped panel can cut it off. Two ways in:
//   - markup:  data-tip="First line\nSecond line"   (found by the listener installed with installTips)
//   - code:    showTip(x, y, [{ t: "text", dim: true, color: "#4ade80" }, ...])   (used by the graphs while the pointer moves)
let el = null, last = "", owner = "";
const ensure = () => {
  if (!el) { el = document.createElement("div"); el.className = "xmtip"; el.setAttribute("role", "tooltip"); document.body.appendChild(el); }
  return el;
};
export function showTip(x, y, lines, by = "code") {
  const e = ensure(), key = JSON.stringify(lines); owner = by;
  if (key !== last) {
    last = key; e.textContent = "";
    lines.forEach((l, i) => {
      const o = typeof l === "string" ? { t: l, dim: i > 0 } : l, d = document.createElement("div");
      d.textContent = o.t; if (o.dim) d.className = "dim"; if (o.color) d.style.color = o.color; e.appendChild(d);
    });
  }
  const w = e.offsetWidth, h = e.offsetHeight, W = window.innerWidth, H = window.innerHeight;
  let l = x + 14, t = y + 18;
  if (l + w > W - 8) l = x - w - 14;   // no room on the right: flip to the left of the pointer
  if (t + h > H - 8) t = y - h - 14;   // no room below: flip above
  e.style.transform = `translate(${Math.max(8, l)}px,${Math.max(8, t)}px)`; e.style.opacity = 1;
}
export function hideTip() { if (el) el.style.opacity = 0; last = ""; owner = ""; }
export function installTips() {
  document.addEventListener("mousemove", e => {
    const t = e.target.closest?.("[data-tip]");
    if (t) showTip(e.clientX, e.clientY, t.dataset.tip.split("\n"), "data");
    else if (owner === "data") hideTip();
  }, { passive: true });
  document.addEventListener("mouseleave", hideTip); window.addEventListener("blur", hideTip);
  document.addEventListener("scroll", hideTip, true); document.addEventListener("mousedown", hideTip, true);
}
