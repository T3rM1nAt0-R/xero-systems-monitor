// Pick mode: elements of the window carry data-look="<setting id>"; hovering one names it and a click takes you to that setting in the panel. Pure.
// id: [what the element is, the panel section it is in, the setting's name there]
export const LOOKS = {
  "text.machine": ["Machine name", "Text", "Machine name"], "text.section": ["Section heading", "Text", "Section"], "text.number": ["Big number", "Text", "Numbers"], "text.label": ["Graph label", "Text", "Labels"],
  "graph.style": ["Graph", "Graphs", "Style"], "layout.tabs": ["Tabs", "Layout", "Tab style"], "colors.bg": ["Background", "Colours", "Background"], "colors.acc": ["Status dot", "Colours", "Accent"],
  "shape.radius": ["Card", "Shape", "Corner radius"], "shape.family": ["Top bar", "Shape", "Style family"],
};
// "Section heading — Text › Section", or "" for an id nobody knows.
export function lookLabel(id) {
  const k = LOOKS[id];
  return k ? `${k[0]} — ${k[1]} › ${k[2]}` : "";
}
// The nearest element at or above `el` that names a setting, ignoring anything inside the panel itself: { el, id } or null.
export function lookTarget(el) {
  const hit = el?.closest?.("[data-look]");
  if (!hit || hit.closest(".cpanel")) return null;
  return LOOKS[hit.dataset.look] ? { el: hit, id: hit.dataset.look } : null;
}
