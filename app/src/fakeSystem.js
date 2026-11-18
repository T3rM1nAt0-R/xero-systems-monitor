// Demo answers for system_query and system_action (docs/window-api.md): the same text shapes the real shell sends back.
const UNITS = [
  ["ssh.service", "active", "running", "OpenBSD Secure Shell server"], ["cron.service", "active", "running", "Regular background program processing daemon"],
  ["docker.service", "active", "running", "Docker Application Container Engine"], ["nginx.service", "active", "running", "A high performance web server"],
  ["backup-nightly.service", "failed", "failed", "Nightly backup job"], ["unattended-upgrades.service", "inactive", "dead", "Unattended Upgrades Shutdown"],
  ["cups.service", "inactive", "dead", "CUPS Scheduler"],
];
const WIN = [["Spooler", "Print Spooler", "Running", "Automatic"], ["Dhcp", "DHCP Client", "Running", "Automatic"], ["WSearch", "Windows Search", "Running", "Automatic"], ["BITS", "Background Intelligent Transfer Service", "Stopped", "Manual"], ["Fax", "Fax", "Stopped", "Disabled"]];
const DEMO_UPDATES = 7;
const units = () => UNITS.map(u => `${u[0]} loaded ${u[1]} ${u[2]} ${u[3]}`).join("\n") + "\n";
const win = () => JSON.stringify(WIN.map(w => ({ Name: w[0], DisplayName: w[1], Status: w[2], StartType: w[3] })));

export function systemQuery(machine, query) {
  if (!machine) throw new Error("That machine is not in the list.");
  const pc = machine.kind === "local";
  if (query === "services") return pc ? win() : units();
  if (query === "updates") { if (pc) throw new Error("Updates are only checked on Linux machines."); return `apt ${DEMO_UPDATES}\n`; }
  throw new Error("Not a query.");
}
const PAST = { restart: "Restarted", stop: "Stopped", start: "Started" };
export function systemAction(act, name) {
  if (name && !/^[A-Za-z0-9_.@:-]{1,128}$/.test(name)) throw new Error("That is not a service name.");
  if (PAST[act]) return `${PAST[act]} ${name}. (demo)`;
  if (act === "upgrade") return "Installed the updates. (demo)";
  if (act === "reboot") return "Restarting the machine. (demo)";
  throw new Error("Not an action.");
}

// Demo log lines: newest last for journalctl, as JSON events for This PC. The priority and unit filters work on these.
const LOG = [
  ["error", "backup-nightly.service", "backup-nightly.service: Main process exited, code=exited, status=1/FAILURE"], ["warning", "nginx.service", "upstream server temporarily disabled while reading response header"],
  ["info", "cron.service", "(root) CMD (run-parts /etc/cron.hourly)"], ["warning", "ssh.service", "Failed password for invalid user admin from 192.0.2.99 port 52144 ssh2"],
  ["error", "docker.service", "level=error msg=\"failed to start container web: port is already allocated\""], ["info", "ssh.service", "Accepted publickey for user from 192.0.2.30 port 40022 ssh2"],
];
const RANK_OF = { error: 1, warning: 2, info: 3 }, MAX_RANK = { errors: 1, warnings: 2, all: 3 };
const LOG_STEP_S = 600, LINES = 24;
const LEVEL = { error: "Error", warning: "Warning", info: "Information" };
const stamp = (t, tail) => new Date(t * 1000).toISOString().replace(/\.\d+Z$/, tail);
export function systemLogs(machine, priority, unit) {
  if (!machine) throw new Error("That machine is not in the list.");
  if (!MAX_RANK[priority]) throw new Error("Not a priority.");
  if (unit && !/^[A-Za-z0-9_.@:-]{1,128}$/.test(unit)) throw new Error("That is not a service name.");
  const now = Math.floor(Date.now() / 1000), pc = machine.kind === "local";
  const rows = Array.from({ length: LINES }, (_, i) => ({ t: now - (LINES - i) * LOG_STEP_S, row: LOG[i % LOG.length] }))
    .filter(r => RANK_OF[r.row[0]] <= MAX_RANK[priority] && (pc || !unit || r.row[1] === unit));
  const name = r => r.row[1].replace(".service", "");
  if (pc) return JSON.stringify(rows.map(r => ({ Time: stamp(r.t, ".000Z"), LogName: r.row[0] === "info" ? "Application" : "System", ProviderName: name(r), Level: LEVEL[r.row[0]], Message: r.row[2] })));
  return rows.map(r => `${stamp(r.t, "+0000")} example-server ${name(r)}[812]: ${r.row[2]}`).join("\n") + "\n";
}
