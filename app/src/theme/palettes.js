import { normLook } from "./model.js";
import { cleanColors } from "./modes.js";
// The built-in themes. Each has a dark and a light version, designed by hand (not an inversion); the plain Dark theme's are the tokens (tokens.css). The others are three base colours
// (everything else is derived from them, colors.js) plus a few extras, once per side. The popular palettes use the colours their authors publish (all MIT or similarly open): Dracula, Nord,
// Catppuccin, Gruvbox, Tokyo Night, Solarized; where an author has no light version, the light one is a hand-made twin in the same hues, darkened until it reads.
const T = (id, name, look, dark, light) => ({ id, name, look: normLook(look), colors: cleanColors({ dark, light }), builtIn: true });
// A theme from a published palette: per side its background, text and accent, and the named hues that colour the graphs and the good / warning / bad states.
const side = ([bg, fg, acc, h]) => ({ bg, fg, acc, cpu: h.green, temp: h.orange, ram: h.blue, gpu: h.purple, gtemp: h.red, vram: h.cyan, down: h.blue, up: h.pink, ping: h.cyan, disk: h.yellow, good: h.green, warn: h.yellow, bad: h.red });
const palette = (id, name, dark, light) => T(id, name, {}, side(dark), side(light));
const MONO = { font: "jetbrains-mono" };
const TERMINAL_TEXT = Object.fromEntries(["machine", "group", "section", "number", "label", "small"].map(l => [l, MONO]));
// Dark first, then light, for each theme.
export const PRESETS = [
  T("dark", "Dark", {}, {}, {}),
  T("midnight", "Midnight", {}, { bg: "#05070f", fg: "#dbe4ff", acc: "#7aa2ff", ping: "#7aa2ff" }, { bg: "#eef2fb", fg: "#0f1a3a", acc: "#2a52c9", ping: "#2a52c9" }),
  T("contrast", "Contrast", { shape: { border: "bold" } }, { bg: "#000000", fg: "#ffffff", acc: "#ffe600", good: "#4dff88", warn: "#ffb000", bad: "#ff6b6b" }, { bg: "#ffffff", fg: "#000000", acc: "#0033cc", good: "#006b2d", warn: "#8a4b00", bad: "#b00020" }),
  T("neon", "Neon", { graph: { glow: true } }, { bg: "#0a0010", fg: "#f5eaff", acc: "#ff2bd6", good: "#39ff14", warn: "#ffee00", bad: "#ff3860", cpu: "#39ff14", ram: "#00e5ff", gpu: "#ff2bd6", temp: "#ff9100", disk: "#ffee00" },
    { bg: "#fbf2ff", fg: "#2a0a3a", acc: "#a8008f", good: "#0a7a00", warn: "#7d6200", bad: "#c0002a", cpu: "#0a7a00", ram: "#00718a", gpu: "#a8008f", temp: "#b34700", disk: "#7d6200" }),
  T("terminal", "Terminal", { text: TERMINAL_TEXT, shape: { family: "terminal", scan: true }, surface: { glass: "off" } }, { bg: "#000000", fg: "#39ff6a", acc: "#39ff6a", good: "#39ff6a", warn: "#ffd75e", bad: "#ff5f5f" },
    { bg: "#f4f7f2", fg: "#0b5d1e", acc: "#0b5d1e", good: "#0b5d1e", warn: "#7a5a00", bad: "#b3261e" }),
  T("blueprint", "Blueprint", { shape: { family: "blueprint" }, surface: { glass: "off" } }, { bg: "#0b2e63", fg: "#ffffff", acc: "#9fd3ff", good: "#7dffa8", warn: "#ffd75e", bad: "#ff9a9a" },
    { bg: "#e8f1fb", fg: "#0a2a5e", acc: "#0b5cc7", good: "#0b6b3a", warn: "#8a5a00", bad: "#b3261e" }),
  palette("dracula", "Dracula", ["#282a36", "#f8f8f2", "#bd93f9", { green: "#50fa7b", yellow: "#f1fa8c", orange: "#ffb86c", red: "#ff5555", blue: "#8be9fd", purple: "#bd93f9", cyan: "#8be9fd", pink: "#ff79c6" }],
    ["#f2eefb", "#282a36", "#6b3fc0", { green: "#17803a", yellow: "#8a6d00", orange: "#b35400", red: "#c4262e", blue: "#1c6fa8", purple: "#6b3fc0", cyan: "#0b7285", pink: "#b0306f" }]),
  palette("nord", "Nord", ["#2e3440", "#eceff4", "#88c0d0", { green: "#a3be8c", yellow: "#ebcb8b", orange: "#d08770", red: "#bf616a", blue: "#81a1c1", purple: "#b48ead", cyan: "#88c0d0", pink: "#b48ead" }],
    ["#eceff4", "#2e3440", "#4f6f98", { green: "#4f7a3a", yellow: "#8a6a1f", orange: "#b0502f", red: "#a23f4a", blue: "#4c6f9a", purple: "#8a5a85", cyan: "#2f7f92", pink: "#8a5a85" }]),
  palette("catppuccin", "Catppuccin", ["#1e1e2e", "#cdd6f4", "#cba6f7", { green: "#a6e3a1", yellow: "#f9e2af", orange: "#fab387", red: "#f38ba8", blue: "#89b4fa", purple: "#cba6f7", cyan: "#74c7ec", pink: "#f5c2e7" }],
    ["#eff1f5", "#4c4f69", "#8839ef", { green: "#2f8a1e", yellow: "#b8730f", orange: "#d9540a", red: "#d20f39", blue: "#1e66f5", purple: "#8839ef", cyan: "#17859a", pink: "#c24fa6" }]),
  palette("gruvbox", "Gruvbox", ["#282828", "#ebdbb2", "#fabd2f", { green: "#b8bb26", yellow: "#fabd2f", orange: "#fe8019", red: "#fb4934", blue: "#83a598", purple: "#d3869b", cyan: "#8ec07c", pink: "#d3869b" }],
    ["#fbf1c7", "#3c3836", "#b57614", { green: "#79740e", yellow: "#b57614", orange: "#af3a03", red: "#9d0006", blue: "#076678", purple: "#8f3f71", cyan: "#427b58", pink: "#8f3f71" }]),
  palette("tokyo-night", "Tokyo Night", ["#1a1b26", "#c0caf5", "#7aa2f7", { green: "#9ece6a", yellow: "#e0af68", orange: "#ff9e64", red: "#f7768e", blue: "#7aa2f7", purple: "#bb9af7", cyan: "#7dcfff", pink: "#bb9af7" }],
    ["#e1e2e7", "#2f4f9a", "#2e5fc9", { green: "#587539", yellow: "#8c6c3e", orange: "#b15c00", red: "#c64343", blue: "#2e5fc9", purple: "#7e3fd0", cyan: "#007197", pink: "#7e3fd0" }]),
  palette("solarized", "Solarized", ["#002b36", "#93a1a1", "#268bd2", { green: "#859900", yellow: "#b58900", orange: "#cb4b16", red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#2aa198", pink: "#d33682" }],
    ["#fdf6e3", "#073642", "#268bd2", { green: "#728300", yellow: "#9a7400", orange: "#cb4b16", red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#1f8b83", pink: "#d33682" }]),
];
// The first six are the plain built-in themes; the rest are the popular palettes.
export const BUILT_IN_COUNT = 6;
