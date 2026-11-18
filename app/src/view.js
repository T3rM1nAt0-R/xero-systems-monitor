// Pure helpers for the view control, the machines strip switch and the hidden machines.
export const VIEWS = [["full", "Full"], ["compact", "Compact"], ["mini", "Mini"]];
export const STRIP_MODES = [["auto", "Auto"], ["on", "On"], ["off", "Off"]];

// Which of Full / Compact / Mini is showing.
export const viewOf = (compact, mini) => (mini ? "mini" : compact ? "compact" : "full");
// What picking `want` changes: { compact, mini }. Mini keeps your Full or Compact choice for when you expand again (compact: null).
export const viewChange = want => ({ compact: want === "mini" ? null : want === "compact", mini: want === "mini" });

// What the C key (and "Compact view") does: from Full it goes to Compact, from Compact back to Full, and from Mini it leaves Mini for Compact. { compact, mini }
export const nextCompact = (compact, mini) => ({ compact: mini ? true : !compact, mini: false });

// Should the machines strip show? "on" and "off" are plain; "auto" hides it with one machine, or when every card already fits the window.
export function showStrip(mode, count, fits) {
  if (count < 1) return false;
  if (mode === "on") return true;
  if (mode === "off") return false;
  return count > 1 && !fits;
}
// Do the cards (everything but the strip) fit in the window without scrolling?
export const fitsWindow = (contentHeight, windowHeight) => contentHeight <= windowHeight;

// The machines that are not hidden, in the same order.
export const visibleMachines = (ms, hidden) => (hidden.length ? ms.filter(m => !hidden.includes(m.name)) : ms);
export const hideName = (hidden, name) => (hidden.includes(name) ? hidden : [...hidden, name]);
export const showName = (hidden, name) => hidden.filter(n => n !== name);
