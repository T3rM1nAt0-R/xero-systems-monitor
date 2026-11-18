// The sections of the Customize panel, in order, and the search over its settings. Pure.
export const SECTIONS = [["theme", "Theme"], ["colors", "Colours"], ["text", "Text"], ["surfaces", "Surfaces"], ["graphs", "Graphs"], ["layout", "Layout"], ["motion", "Motion"]];
// Does every word of `query` appear in the setting's label, its keywords or its id?
export function matches(query, ...texts) {
  const hay = texts.join(" ").toLowerCase();
  return String(query).toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
// The section whose top has been scrolled past: `ids` are the sections in order, `tops` their offsets from the top of the scroll area, `at` how far it is scrolled.
export function activeSection(ids, tops, at) {
  let k = 0;
  tops.forEach((t, i) => { if (t <= at) k = i; });
  return ids[k];
}
