// Pure helpers for "my order": machine cards and the groups inside a card. A saved order may be out of date, so it is always merged with what exists now.
export const GROUPS = [["cpu", "CPU"], ["gpu", "GPU"], ["net", "Network"], ["disk", "Disk"], ["run", "Runners"], ["svc", "Containers & services"]];
const KEYS = GROUPS.map(g => g[0]);
export const groupLabel = k => GROUPS.find(g => g[0] === k)?.[1] || k;

// Saved names that still exist (once each, in saved order), then new names at the end.
export const mergeOrder = (saved, names) => {
  const have = new Set(names), seen = new Set(), keep = [];
  for (const n of Array.isArray(saved) ? saved : []) if (have.has(n) && !seen.has(n)) { seen.add(n); keep.push(n); }
  return [...keep, ...names.filter(n => !seen.has(n))];
};
export const applyOrder = (items, saved, key = x => x.name) => {
  const by = new Map(items.map(x => [key(x), x]));
  return mergeOrder(saved, items.map(key)).map(n => by.get(n));
};
// Put `from` where `to` is (drag and drop). Unknown names change nothing.
export const moveTo = (order, from, to) => {
  const a = order.filter(n => n !== from), i = a.indexOf(to);
  if (from === to || i < 0 || !order.includes(from)) return order;
  a.splice(order.indexOf(from) < order.indexOf(to) ? i + 1 : i, 0, from);
  return a;
};
// One step up (-1) or down (1); the ends stay put.
export const moveBy = (order, name, step) => {
  const i = order.indexOf(name), j = i + step;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const a = [...order]; [a[i], a[j]] = [a[j], a[i]]; return a;
};
// The strip lists This PC first, then the rest in the chosen order.
export const stripOrder = (ms, local) => [...ms.filter(m => m.name === local), ...ms.filter(m => m.name !== local)];

// Per-machine group choices: { order: [...all keys], hidden: [...keys] }.
export const normGroups = s => ({ order: mergeOrder(s?.order, KEYS), hidden: (Array.isArray(s?.hidden) ? s.hidden : []).filter((k, i, a) => KEYS.includes(k) && a.indexOf(k) === i) });
export const toggleHidden = (g, k) => ({ ...g, hidden: g.hidden.includes(k) ? g.hidden.filter(x => x !== k) : [...g.hidden, k] });
export const moveGroup = (g, k, step) => ({ ...g, order: moveBy(g.order, k, step) });
// Which groups a machine can show right now (GPU, runners and services only when it has them).
export const groupsFor = d => KEYS.filter(k => k === "gpu" ? d?.gpu != null : k === "run" ? !!d?.runners : k === "svc" ? !!(d?.docker || d?.failed?.length) : true);
