// Pure ranking for the Ctrl+K palette. Every word typed must appear in the item; earlier and whole-word matches rank higher.
const rank = (text, w) => { const i = text.indexOf(w); return i < 0 ? null : i === 0 ? 0 : /[\s>:/]/.test(text[i - 1]) ? 1 : 2; };
export const scoreItem = (item, query) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean), label = item.label.toLowerCase(), extra = (item.words || "").toLowerCase();
  let total = 0;
  for (const w of words) { const r = rank(label, w) ?? (rank(extra, w) == null ? null : 3); if (r == null) return null; total += r; }
  return total;
};
// Items that match, best first (ties keep the original order). An empty query keeps everything in order.
export const filterItems = (items, query) => {
  if (!query.trim()) return items;
  return items.map((it, i) => [scoreItem(it, query), i, it]).filter(x => x[0] != null).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
};
