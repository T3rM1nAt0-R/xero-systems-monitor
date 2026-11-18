import useCustom from "./theme/useCustom.js";
// The window's whole look is the Customize look (themes, colours, text size, fonts, graphs, sizes), remembered. Light or dark is not a setting of its own:
// it follows the background colour of the look that is shown (theme/useCustom.js).
export default function useLook() {
  return { custom: useCustom() };
}
