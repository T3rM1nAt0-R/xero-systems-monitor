// The fonts a text level can use. `id` is what is saved; `stack` is the CSS font-family value. "system" keeps the app's own stack (tokens.css).
// Every bundled family is an SIL Open Font Licence 1.1 font from the @fontsource packages (see THIRD-PARTY-NOTICES.md and styles/fonts.css).
const SANS = ", system-ui, sans-serif", MONO = ", ui-monospace, Consolas, monospace";
const BUNDLED = [["Inter", SANS], ["Roboto", SANS], ["IBM Plex Sans", SANS], ["Source Sans 3", SANS], ["Nunito", SANS], ["Poppins", SANS], ["Montserrat", SANS], ["Lato", SANS], ["Fira Sans", SANS], ["Space Grotesk", SANS], ["JetBrains Mono", MONO], ["Fira Code", MONO]];
export const FONTS = [
  { id: "system", label: "System", stack: "" },
  ...BUNDLED.map(([name, tail]) => ({ id: name.toLowerCase().replace(/ /g, "-"), label: name, stack: `"${name}"${tail}` })),
];
export const FONT_IDS = FONTS.map(f => f.id);
export const fontStack = id => FONTS.find(f => f.id === id)?.stack || "";
