import HoldButton from "./HoldButton.jsx";
import ActionNote from "./ActionNote.jsx";
import { useSystemQuery, useSystemAction } from "./useSystem.js";
import { parseUpdates, UPDATES_EVERY_MS } from "./system.js";
import { restartWhy } from "./format.js";
// Linux machines: how many updates are waiting (looked up every 30 minutes), "Restart needed", and the Install updates and Restart machine buttons (held to confirm).
// Both run with `sudo -n`; if sudo wants a password the note shows the command to copy. Shows nothing on machines without apt or dnf (This PC).
export default function MachineBar({ machine, d }) {
  const q = useSystemQuery(machine, "updates", UPDATES_EVERY_MS), act = useSystemAction(machine, q.reload), u = parseUpdates(q.text);
  if (!u) return null;
  return (
    <div className="machbar">
      <div className="sysline">
        <b>{u.count ? `${u.count} update${u.count === 1 ? "" : "s"} waiting` : "Up to date"}</b><span className="sub">checked with {u.manager}</span>
        {d.restart && <span className="restart" title={restartWhy(d)}>Restart needed</span>}
        <span className="grow" />
        <HoldButton disabled={!!act.busy || !u.count} onDone={() => act.run("upgrade")} label={act.busy === "upgrade" ? "Installing…" : "Install updates"} title="Hold to confirm" />
        <HoldButton disabled={!!act.busy} onDone={() => act.run("reboot")} label="Restart machine" title="Hold to confirm" />
      </div>
      <ActionNote note={act.note} onClose={act.clear} />
    </div>);
}
