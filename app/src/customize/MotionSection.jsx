import { MOTION_LEVELS, valueOf } from "../theme/model.js";
import { Row, Seg } from "./controls.jsx";
// Motion: how much moves.
export default function MotionSection({ c }) {
  return (
    <Row id="motion" label="Motion" keys="animation animate reduce movement" c={c} hint="Full: numbers roll, graphs slide and glow, cards glide. Subtle: only quick folds and fades. Off: nothing moves. It also turns off by itself when Windows asks for less motion.">
      <Seg label="Motion" value={valueOf(c.look, "motion")} options={MOTION_LEVELS} onChange={v => c.edit(["motion"], v)} /></Row>);
}
