import { normLook } from "./model.js";
import { isLight } from "./colors.js";
// The built-in themes. Dark and Light are the plain tokens (tokens.css). The others are three base colours (everything else is derived from them, colors.js) plus
// a few extras. The popular palettes use the colours their authors publish (all MIT or similarly open): Dracula, Nord, Catppuccin, Gruvbox, Tokyo Night, Solarized.
const T = (id, name, base, look) => ({ id, name, base, look: normLook(look), builtIn: true });
// A theme from a published palette: its background, text and accent, and the named hues that colour the graphs and the good / warning / bad states.
function palette(id, name, bg, fg, acc, h) {
  const colors = { bg, fg, acc, cpu: h.green, temp: h.orange, ram: h.blue, gpu: h.purple, gtemp: h.red, vram: h.cyan, down: h.blue, up: h.pink, ping: h.cyan, disk: h.yellow, good: h.green, warn: h.yellow, bad: h.red };
  return T(id, name, isLight(bg) ? "light" : "dark", { colors });
}
const MONO = { font: "jetbrains-mono" };
const TERMINAL_TEXT = Object.fromEntries(["machine", "group", "section", "number", "label", "small"].map(l => [l, MONO]));
export const PRESETS = [
  T("dark", "Dark", "dark", {}),
  T("light", "Light", "light", {}),
  T("midnight", "Midnight", "dark", { colors: { bg: "#05070f", fg: "#dbe4ff", acc: "#7aa2ff", ping: "#7aa2ff" } }),
  T("contrast", "Contrast", "dark", { colors: { bg: "#000000", fg: "#ffffff", acc: "#ffe600", good: "#4dff88", warn: "#ffb000", bad: "#ff6b6b" }, shape: { border: "bold" } }),
  T("neon", "Neon", "dark", { colors: { bg: "#0a0010", fg: "#f5eaff", acc: "#ff2bd6", good: "#39ff14", warn: "#ffee00", bad: "#ff3860", cpu: "#39ff14", ram: "#00e5ff", gpu: "#ff2bd6", temp: "#ff9100", disk: "#ffee00" }, graph: { glow: true } }),
  T("terminal", "Terminal", "dark", { colors: { bg: "#000000", fg: "#39ff6a", acc: "#39ff6a", good: "#39ff6a", warn: "#ffd75e", bad: "#ff5f5f" }, text: TERMINAL_TEXT, shape: { family: "terminal", scan: true }, surface: { glass: "off" } }),
  T("blueprint", "Blueprint", "dark", { colors: { bg: "#0b2e63", fg: "#ffffff", acc: "#9fd3ff", good: "#7dffa8", warn: "#ffd75e", bad: "#ff9a9a" }, shape: { family: "blueprint" }, surface: { glass: "off" } }),
  palette("dracula", "Dracula", "#282a36", "#f8f8f2", "#bd93f9", { green: "#50fa7b", yellow: "#f1fa8c", orange: "#ffb86c", red: "#ff5555", blue: "#8be9fd", purple: "#bd93f9", cyan: "#8be9fd", pink: "#ff79c6" }),
  palette("nord", "Nord", "#2e3440", "#eceff4", "#88c0d0", { green: "#a3be8c", yellow: "#ebcb8b", orange: "#d08770", red: "#bf616a", blue: "#81a1c1", purple: "#b48ead", cyan: "#88c0d0", pink: "#b48ead" }),
  palette("catppuccin-mocha", "Catppuccin Mocha", "#1e1e2e", "#cdd6f4", "#cba6f7", { green: "#a6e3a1", yellow: "#f9e2af", orange: "#fab387", red: "#f38ba8", blue: "#89b4fa", purple: "#cba6f7", cyan: "#74c7ec", pink: "#f5c2e7" }),
  palette("gruvbox", "Gruvbox", "#282828", "#ebdbb2", "#fabd2f", { green: "#b8bb26", yellow: "#fabd2f", orange: "#fe8019", red: "#fb4934", blue: "#83a598", purple: "#d3869b", cyan: "#8ec07c", pink: "#d3869b" }),
  palette("tokyo-night", "Tokyo Night", "#1a1b26", "#c0caf5", "#7aa2f7", { green: "#9ece6a", yellow: "#e0af68", orange: "#ff9e64", red: "#f7768e", blue: "#7aa2f7", purple: "#bb9af7", cyan: "#7dcfff", pink: "#bb9af7" }),
  palette("solarized-dark", "Solarized Dark", "#002b36", "#93a1a1", "#268bd2", { green: "#859900", yellow: "#b58900", orange: "#cb4b16", red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#2aa198", pink: "#d33682" }),
  palette("solarized-light", "Solarized Light", "#fdf6e3", "#073642", "#268bd2", { green: "#859900", yellow: "#b58900", orange: "#cb4b16", red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#2aa198", pink: "#d33682" }),
  palette("catppuccin-latte", "Catppuccin Latte", "#eff1f5", "#4c4f69", "#8839ef", { green: "#40a02b", yellow: "#df8e1d", orange: "#fe640b", red: "#d20f39", blue: "#1e66f5", purple: "#8839ef", cyan: "#209fb5", pink: "#ea76cb" }),
];
// The first seven are the plain built-in themes; the rest are the popular palettes.
export const BUILT_IN_COUNT = 7;
