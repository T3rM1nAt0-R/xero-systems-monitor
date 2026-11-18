// Older looks and settings, brought forward so nobody loses their look. The first Customize kept `size: { card, density, scale }` and a top-level `glass`;
// they now live under `layout`, `scale` and `surface`. Everything else kept its place, so a saved theme or exported file from before still reads.
export function migrateLook(raw) {
  const r = raw && typeof raw === "object" ? raw : {}, { size, glass, ...rest } = r;
  const out = { ...rest };
  if (size && typeof size === "object") {
    out.layout = { ...(size.card === undefined ? {} : { card: size.card }), ...(size.density === undefined ? {} : { density: size.density }), ...rest.layout };
    if (rest.scale === undefined && size.scale !== undefined) out.scale = size.scale;
  }
  if (glass !== undefined) out.surface = { glass, ...rest.surface };
  return out;
}
// The built-in theme an old theme id now means: Solarized-like became a real Solarized, and a theme that was the light (or dark) twin of another is now one theme with both versions
// (the mode, not the theme, says which is shown: see migratePrefs).
const RENAMED = { light: "dark", "solarized-dark": "solarized", "solarized-light": "solarized", "catppuccin-mocha": "catppuccin", "catppuccin-latte": "catppuccin" };
export const migrateThemeId = id => RENAMED[id] || id;
