// The mini window follows its content's height. These are the rules for when that may move the window (pure; the timers are in useMiniFit.js).
// The window is resized only when the wanted height really changed, never while the person is dragging an edge, and never many times a second.
export const FIT_STEP = 4, FIT_DEBOUNCE_MS = 250, FIT_PAD = 2, DRAG_HOLD_MS = 600, FIT_POLL_MS = 2000;   // smallest change worth a resize; wait after the last change; spare pixels; how long after a drag the window is left alone; how often to look again
// The height to ask for: the content's layout height (offsetHeight, which animations' transforms never change) rounded up, plus the spare pixels.
export const wantedHeight = content => Math.ceil(content) + FIT_PAD;
// Send a new height only for a real number that differs from the last one sent by at least FIT_STEP.
export const shouldResize = (last, want) => Number.isFinite(want) && want > 0 && (last == null || Math.abs(want - last) >= FIT_STEP);
// True while a resize the person made (not the app) is still fresh.
export const userResizing = (now, lastUserResize) => lastUserResize != null && now - lastUserResize < DRAG_HOLD_MS;
// The layout height of the app's own rows: everything but the dock and dialogs.
export const contentHeight = rows => rows.reduce((h, el) => h + (el.classList.contains("dock") || el.classList.contains("modal") ? 0 : el.offsetHeight), 0);
