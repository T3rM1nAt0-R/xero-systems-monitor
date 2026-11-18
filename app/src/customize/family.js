// What choosing a style family sets: the family itself and, for Terminal, the scanlines that belong to it (every other family clears them). Shape only:
// never colours and never glass. Green on black and white on blue are the Terminal and Blueprint themes (theme/palettes.js). Pure.
// [path, value] pairs for the family tile. The family is always a real choice; the edit store drops it when the theme already has it.
export const familyEdits = id => [["shape.family", id], ["shape.scan", id === "terminal"]];
