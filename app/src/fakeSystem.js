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
