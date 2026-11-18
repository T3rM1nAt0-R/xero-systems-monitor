import { motionLevel, SLOW_MS } from "./motion.js";
// A pinned section flies from where it was to the Overview tab: a small ghost of its title shrinks and fades along the way (transform and opacity, then it is removed).
// Does nothing when either end is missing or motion is not Full.
export function flyTo(from, to, label) {
  if (!from || !to || motionLevel() !== "full" || !from.animate) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), ghost = document.createElement("div");
  ghost.className = "flyghost"; ghost.textContent = label; ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = `left:${a.left}px;top:${a.top}px`;
  document.body.appendChild(ghost);
  const move = ghost.animate([{ transform: "translate(0,0) scale(1)", opacity: 0.95 }, { transform: `translate(${b.left + b.width / 2 - a.left}px,${b.top - a.top}px) scale(.35)`, opacity: 0 }], { duration: SLOW_MS, easing: "cubic-bezier(.5,0,.2,1)" });
  move.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), SLOW_MS + 200);
}
