// Undo and redo for Customize: a list of earlier states, the present one and the later ones. Pure; the state is whatever the caller keeps ({ id, edits }).
export const HISTORY_LIMIT = 100;
export const startHistory = present => ({ past: [], present, future: [], key: "" });
// `next` becomes the present. Repeated changes with the same non-empty `key` (dragging one slider) count as one step.
export function record(h, next, key = "") {
  if (Object.is(next, h.present)) return h;
  if (key && key === h.key) return { ...h, present: next };
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [], key };
}
export const canUndo = h => h.past.length > 0;
export const canRedo = h => h.future.length > 0;
export const undo = h => (canUndo(h) ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: "" } : h);
export const redo = h => (canRedo(h) ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: "" } : h);
