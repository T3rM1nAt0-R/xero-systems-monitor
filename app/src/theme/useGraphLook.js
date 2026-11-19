import { useMemo } from "react";
import { graphOf } from "./model.js";
import useChosen from "./useChosen.js";
// The graph options (style, smoothing, ...) of the look in use, for the chart. Reads the same settings as useCustom and stays one object until they change.
export default function useGraphLook() {
  const { look } = useChosen();
  return useMemo(() => graphOf(look), [look]);
}
