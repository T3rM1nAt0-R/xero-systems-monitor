// What choosing a style family sets: the family itself, and for Terminal and Blueprint the colours and scanlines that make the look (green on black, white on blue). Pure.
const LOOKS = {
  terminal: [["shape.scan", true], ["colors.bg", "#000000"], ["colors.fg", "#39ff6a"], ["colors.acc", "#39ff6a"]],
  blueprint: [["colors.bg", "#0b2e63"], ["colors.fg", "#ffffff"], ["colors.acc", "#9fd3ff"]],
};
// [path, value] pairs for the family tile; Rounded (today's look) clears the family.
export const familyEdits = id => [["shape.family", id === "rounded" ? undefined : id], ...(LOOKS[id] || [])];
