import { memo } from "react";
import { fullColors } from "../theme/css.js";
import { sideOf } from "../theme/appearance.js";
// A small picture of a theme tile drawn in its own colours (SVG, no live data), for the theme gallery.
const LINE_A = "M2 30 L12 24 L22 28 L32 18 L42 22 L52 14 L62 20 L72 12 L82 16 L92 10", LINE_B = "M2 36 L14 33 L26 35 L38 30 L50 33 L62 28 L74 31 L86 27 L98 29";
function Thumb({ theme }) {
  const c = fullColors(theme.look, sideOf(theme));
  return (
    <svg className="cthumb" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="44" fill={c.bg} />
      <rect x="4" y="5" width="22" height="3" rx="1.5" fill={c.fg} /><rect x="4" y="11" width="36" height="2" rx="1" fill={c.dim2} /><circle cx="92" cy="7" r="3" fill={c.acc} />
      <rect x="0" y="17" width="100" height="27" fill={c.card} />
      <path d={LINE_A} fill="none" stroke={c.cpu} strokeWidth="1.6" /><path d={LINE_B} fill="none" stroke={c.ram} strokeWidth="1.6" />
    </svg>);
}
export default memo(Thumb);
