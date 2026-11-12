export const RANGES = [["5 min", 300], ["1 hour", 3600], ["1 day", 86400], ["1 week", 604800], ["1 month", 2592000], ["1 year", 31536000]];
export const snapRange = r => RANGES.reduce((b, [, s]) => Math.abs(s - r) < Math.abs(b - r) ? s : b, 300);   // old saved ranges map to the nearest new one
export const SHORT = l => l.replace(" min", "m").replace(" hour", "h").replace(" day", "d").replace(" week", "w").replace(" month", "mo").replace(" year", "y");
export const KEYS = [["1", "Jump to machine 1, 2, 3…"], ["Esc", "Close a window"], ["C", "Compact view"], ["M", "Mini corner view"], ["[ ]", "Shorter / longer range"], ["E", "Activity drawer"], ["T", "Always on top"], ["?", "This list"]];
