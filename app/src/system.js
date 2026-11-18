// Reading what the machine says about its services and updates. Pure (no React): the Services tab and the tests use it.
// The shell sends back plain text (docs/window-api.md, system_query): systemd's list on Linux, PowerShell's JSON on Windows.

export const HOLD_MS = 800;                   // how long a button is held to confirm
export const UPDATES_EVERY_MS = 30 * 60e3;    // pending updates are looked up again this often
export const SERVICES_EVERY_MS = 60e3;        // the service list is refreshed this often
export const PASSWORD_MARK = "needs-password:";
export const FILTERS = [["all", "All"], ["failed", "Failed"], ["active", "Running"], ["inactive", "Stopped"]];

const RANK = { failed: 0, active: 1, inactive: 2 };
const byRank = (a, b) => RANK[a.state] - RANK[b.state] || a.name.localeCompare(b.name);

// systemctl list-units --plain --no-legend: "unit load active sub description...". Failed first, then running, then stopped.
export function parseUnits(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const p = line.trim().replace(/^[●○×*]\s*/, "").split(/\s+/);
    if (p.length < 4 || !p[0].endsWith(".service") || p[1] === "not-found") continue;
    out.push({ name: p[0], state: p[2] === "failed" ? "failed" : p[2] === "active" ? "active" : "inactive", sub: p[3], desc: p.slice(4).join(" "), start: "" });
  }
  return out.sort(byRank);
}

// Get-Service | ConvertTo-Json: one object or a list of { Name, DisplayName, Status, StartType }.
export function parseWinServices(text) {
  let rows;
  try { rows = JSON.parse(text); } catch { return []; }
  return [].concat(rows || []).filter(r => r && r.Name).map(r => ({ name: String(r.Name), state: r.Status === "Running" ? "active" : "inactive", sub: String(r.Status || "").toLowerCase(), desc: String(r.DisplayName || ""), start: String(r.StartType || "") })).sort(byRank);
}

// Either kind of answer: JSON starts with [ or {, systemd's list does not.
export const parseServices = text => (/^\s*[[{]/.test(String(text || "")) ? parseWinServices(text) : parseUnits(text));

// "apt 3", "dnf 0" or "none" -> { manager, count } or null when the machine has no package manager we know.
export function parseUpdates(text) {
  const m = /^\s*(apt|dnf)\s+(\d+)/.exec(String(text || ""));
  return m ? { manager: m[1], count: Number(m[2]) } : null;
}

export const countStates = list => list.reduce((c, s) => ({ ...c, [s.state]: c[s.state] + 1 }), { active: 0, failed: 0, inactive: 0 });
export const filterServices = (list, filter) => (filter === "all" ? list : list.filter(s => s.state === filter));

// When sudo wanted a password the shell's error is "needs-password:<command>": returns the command to run by hand, else null.
export function passwordCommand(err) {
  const t = String(err?.message ?? err ?? "");
  return t.startsWith(PASSWORD_MARK) ? t.slice(PASSWORD_MARK.length) : null;
}
export const errorText = err => String(err?.message ?? err ?? "");
