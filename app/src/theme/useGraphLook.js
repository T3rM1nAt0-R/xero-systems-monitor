import { useMemo } from "react";
import { usePersisted } from "../store.js";
import { graphOf } from "./model.js";
import { cleanSaved, resolveTheme } from "./presets.js";
// The graph options (style, smoothing, ...) of the look in use, for the chart. Reads the same settings as useCustom and stays one object until they change.
export default function useGraphLook() {
  const [saved] = usePersisted("themes", []), [id] = usePersisted("themeId", ""), [edits] = usePersisted("edits", {});
  return useMemo(() => {
    return graphOf(resolveTheme(cleanSaved(saved), id, edits).look);
  }, [saved, id, edits]);
}
