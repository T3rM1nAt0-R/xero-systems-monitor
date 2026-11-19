import { normLook } from "./model.js";
// The built-in themes, each one version (a tile) of its own: Default, Solarized, Catppuccin, Gruvbox, Tokyo Night, Nord and Contrast come as a real pair (dark and light, from the published palettes
// or designed by hand, not an inversion); Terminal, Dracula, Neon, Midnight and Blueprint are dark only. The plain Default Dark and Default Light are the tokens (tokens.css). The others are three base colours
// (everything else is derived from them, colors.js) plus a few extras. The popular palettes use the colours their authors publish (all MIT or similarly open).
const T = (id, name, side, look, colors) => ({ id, name, side, look: normLook({ ...look, colors }), builtIn: true });
// A tile from a published palette: its background, text and accent, and the named hues that colour the graphs and the good / warning / bad states.
const hues = ([bg, fg, acc, h]) => ({ bg, fg, acc, cpu: h.green, temp: h.orange, ram: h.blue, gpu: h.purple, gtemp: h.red, vram: h.cyan, down: h.blue, up: h.pink, ping: h.cyan, disk: h.yellow, good: h.green, warn: h.yellow, bad: h.red });
const MONO = { font: "jetbrains-mono" };
const TERMINAL_TEXT = Object.fromEntries(["machine", "group", "section", "number", "label", "small"].map(l => [l, MONO]));
// Each entry: [dark tile, light tile]. A tile is T(id, name, side, shared look, colours); `pal` makes a published palette's two.
const pal = (id, lightId, names, dark, light) => [T(id, names[0], "dark", {}, hues(dark)), T(lightId, names[1], "light", {}, hues(light))];
const PAIRS = [
  [T("dark", "Default Dark", "dark", {}, {}), T("default-light", "Default Light", "light", {}, {})],
  pal("solarized", "solarized-light", ["Solarized Dark", "Solarized Light"], ["#002b36", "#93a1a1", "#268bd2", { green: "#859900", yellow: "#b58900", orange: "#cb4b16", red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#2aa198", pink: "#d33682" }],
    ["#fdf6e3", "#073642", "#268bd2", { green: "#728300", yellow: "#9a7400", orange: "#cb4b16", red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#1f8b83", pink: "#d33682" }]),
  pal("catppuccin", "catppuccin-latte", ["Catppuccin Mocha", "Catppuccin Latte"], ["#1e1e2e", "#cdd6f4", "#cba6f7", { green: "#a6e3a1", yellow: "#f9e2af", orange: "#fab387", red: "#f38ba8", blue: "#89b4fa", purple: "#cba6f7", cyan: "#74c7ec", pink: "#f5c2e7" }],
    ["#eff1f5", "#4c4f69", "#8839ef", { green: "#2f8a1e", yellow: "#b8730f", orange: "#d9540a", red: "#d20f39", blue: "#1e66f5", purple: "#8839ef", cyan: "#17859a", pink: "#c24fa6" }]),
  pal("gruvbox", "gruvbox-light", ["Gruvbox Dark", "Gruvbox Light"], ["#282828", "#ebdbb2", "#fabd2f", { green: "#b8bb26", yellow: "#fabd2f", orange: "#fe8019", red: "#fb4934", blue: "#83a598", purple: "#d3869b", cyan: "#8ec07c", pink: "#d3869b" }],
    ["#fbf1c7", "#3c3836", "#b57614", { green: "#79740e", yellow: "#b57614", orange: "#af3a03", red: "#9d0006", blue: "#076678", purple: "#8f3f71", cyan: "#427b58", pink: "#8f3f71" }]),
  pal("tokyo-night", "tokyo-day", ["Tokyo Night", "Tokyo Day"], ["#1a1b26", "#c0caf5", "#7aa2f7", { green: "#9ece6a", yellow: "#e0af68", orange: "#ff9e64", red: "#f7768e", blue: "#7aa2f7", purple: "#bb9af7", cyan: "#7dcfff", pink: "#bb9af7" }],
    ["#e1e2e7", "#2f4f9a", "#2e5fc9", { green: "#587539", yellow: "#8c6c3e", orange: "#b15c00", red: "#c64343", blue: "#2e5fc9", purple: "#7e3fd0", cyan: "#007197", pink: "#7e3fd0" }]),
  pal("nord", "nord-light", ["Nord Polar Night", "Nord Snow Storm"], ["#2e3440", "#eceff4", "#88c0d0", { green: "#a3be8c", yellow: "#ebcb8b", orange: "#d08770", red: "#bf616a", blue: "#81a1c1", purple: "#b48ead", cyan: "#88c0d0", pink: "#b48ead" }],
    ["#eceff4", "#2e3440", "#4f6f98", { green: "#4f7a3a", yellow: "#8a6a1f", orange: "#b0502f", red: "#a23f4a", blue: "#4c6f9a", purple: "#8a5a85", cyan: "#2f7f92", pink: "#8a5a85" }]),
  [T("contrast", "Contrast Dark", "dark", { shape: { border: "bold" } }, { bg: "#000000", fg: "#ffffff", acc: "#ffe600", good: "#4dff88", warn: "#ffb000", bad: "#ff6b6b" }),
    T("contrast-light", "Contrast Light", "light", { shape: { border: "bold" } }, { bg: "#ffffff", fg: "#000000", acc: "#0033cc", good: "#006b2d", warn: "#8a4b00", bad: "#b00020" })],
];
const DARK_ONLY = [
  T("terminal", "Terminal", "dark", { text: TERMINAL_TEXT, shape: { family: "terminal", scan: true }, surface: { glass: "off" } }, { bg: "#000000", fg: "#39ff6a", acc: "#39ff6a", good: "#39ff6a", warn: "#ffd75e", bad: "#ff5f5f" }),
  T("dracula", "Dracula", "dark", {}, hues(["#282a36", "#f8f8f2", "#bd93f9", { green: "#50fa7b", yellow: "#f1fa8c", orange: "#ffb86c", red: "#ff5555", blue: "#8be9fd", purple: "#bd93f9", cyan: "#8be9fd", pink: "#ff79c6" }])),
  T("neon", "Neon", "dark", { graph: { glow: true } }, { bg: "#0a0010", fg: "#f5eaff", acc: "#ff2bd6", good: "#39ff14", warn: "#ffee00", bad: "#ff3860", cpu: "#39ff14", ram: "#00e5ff", gpu: "#ff2bd6", temp: "#ff9100", disk: "#ffee00" }),
  T("midnight", "Midnight", "dark", {}, { bg: "#05070f", fg: "#dbe4ff", acc: "#7aa2ff", ping: "#7aa2ff" }),
  T("blueprint", "Blueprint", "dark", { shape: { family: "blueprint" }, surface: { glass: "off" } }, { bg: "#0b2e63", fg: "#ffffff", acc: "#9fd3ff", good: "#7dffa8", warn: "#ffd75e", bad: "#ff9a9a" }),
];
// Dark tiles first, then the light ones (the gallery shows them in two groups).
export const PRESETS = [...PAIRS.map(p => p[0]), ...DARK_ONLY, ...PAIRS.map(p => p[1])];
// The light version of each built-in theme that has one: { dark tile id: light tile id }.
export const PAIR_LIGHT = Object.fromEntries(PAIRS.map(([d, l]) => [d.id, l.id]));
