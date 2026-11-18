import { FIELDS, TEXT_LEVELS, WEIGHTS, flatten, getPath, mergeLook, setPath, unflatten, valueOf } from "./model.js";
// An edit is kept only when it changes what the theme shows. Choosing what the theme already has is no edit; choosing the plain value where the theme says
// otherwise (the plain "Rounded" on a theme with its own family, "off" for a switch the theme turns on, 100% text size on a theme that enlarges text) is a real one. Pure.
const SIZES = Object.fromEntries(TEXT_LEVELS.map(l => [l.id, l.size])), PLAIN_WEIGHT = WEIGHTS[0][0];
// What the look shows for the setting at `path`, or what the plain window has when the look says nothing.
function shown(look, path) {
  const field = path.join(".");
  if (FIELDS[field]) return valueOf(look, field);
  const v = getPath(look, path);
  if (v !== undefined || path[0] !== "text") return v;
  return { font: "system", size: SIZES[path[1]], weight: PLAIN_WEIGHT }[path[2]];
}
// `edits` without the ones that change nothing on top of the theme's look.
export function pruneEdits(themeLook, edits) {
  const all = flatten(edits), drop = all.filter(([k, v]) => {
    const path = k.split("."), without = mergeLook(themeLook, unflatten(all.filter(([o]) => o !== k)));
    return Object.is(shown(without, path), v);
  });
  return drop.reduce((e, [k]) => setPath(e, k.split("."), undefined), edits);
}
