import { sparkPath, SPARK } from "./spark.js";
// A small inline line of one metric, shown on folded bars. Draws nothing when there is no history yet.
export default function Spark({ pts, color, max = 100 }) {
  const d = sparkPath(pts, max);
  return d ? <svg className="minispark" width={SPARK.w} height={SPARK.h} viewBox={`0 0 ${SPARK.w} ${SPARK.h}`} aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /></svg> : null;
}
