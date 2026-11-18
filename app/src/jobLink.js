import { openLink } from "./api.js";
// Props that make an element open a GitHub address when clicked (or when Enter or Space is pressed). Nothing when there is no address.
export const linkProps = url => url ? {
  role: "link", tabIndex: 0, onClick: () => openLink(url),
  onKeyDown: e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openLink(url)),
} : {};
export const linkClass = url => (url ? " link" : "");
