import { memo } from "react";
import MachineBody from "./Detail.jsx";
import GroupsMenu from "./GroupsMenu.jsx";
import { GroupLayout, useGroupPrefs } from "./groupPrefs.js";
import { groupsFor } from "./order.js";
import Collapse from "./Collapse.jsx";
import MachineMenu from "./MachineMenu.jsx";
import CardBar from "./CardBar.jsx";
import { useCardFold, foldProps } from "./fold.js";
import { isCalm } from "./calm.js";
import { hwFacts } from "./hwStrip.js";
import { gb, upLine, uptime, restartWhy, isWarn, hm, hotMin, WATCH } from "./format.js";
// The details that used to fill the header (hardware names, address, uptime and restart time): one hover tooltip on the (i) icon.
const infoTip = (d, now) => [...hwFacts(d).map(([k, v]) => `${k}: ${v}`), d.ip && `Address: ${d.ip}`, d.uptime != null && upLine(d.uptime, now), d.restart && "Restart needed for updates" + (restartWhy(d) ? ": " + restartWhy(d) : "")].filter(Boolean).join("\n");
function Card({ m, h, h2, rows, fc, range, now, lastOk, hot, gone, limits, auto, flat, onOpen: open, onTry, onHide }) {
  const d = m.d || {}, [groups, setGroups] = useGroupPrefs(m.name);
  const off = !!m.err;
  const warnings = WATCH.filter(k => !off && isWarn(k, d[k], limits));
  const state = off ? `Offline` : hot.cpu ? `Working hard for ${hotMin(hot.cpu, now * 1000)} min` : warnings.length ? "Needs a look" : "All calm";
  const bad = !off && (hot.cpu || warnings.length);
  const [shown, flip] = useCardFold(m.name, isCalm(m, hot, rows, now, limits), auto), isOpen = flat || shown;   // folding is ignored inside the compact view
  const head = flat ? {} : { ...foldProps(isOpen, flip), className: "chead fold" };
  const chev = !flat && <b className="chev">{isOpen ? "▾" : "▸"}</b>;
  if (off) return (
    <article className={"card off" + (isOpen ? "" : " folded")} id={"m-" + m.name}>
      <div className="chead" {...head}>{chev}<i className="dot off" /><h3>{m.name}</h3><span className="state">Offline{lastOk ? ` since ${hm(lastOk)}` : ""}</span><button className="open" onClick={e => { e.stopPropagation(); open(m.name); }}>Open</button>{onHide && <MachineMenu name={m.name} onHide={onHide} />}</div>
      {isOpen && <div className="offbox"><strong>Can&apos;t reach {m.name}</strong><span>{lastOk ? `Last heard from at ${hm(lastOk)}. ` : ""}It may be restarting, or the network dropped.</span>
        {m.d && <div className="last">{d.cpu != null && <span>Last seen: CPU {d.cpu.toFixed(0)}%</span>}{d.temp != null && <span>{d.temp.toFixed(0)}°C</span>}{d.ram_gb && <span>Memory {gb(d.ram_gb[0])} / {d.ram_gb[1].toFixed(0)} GB</span>}</div>}
        <button onClick={() => onTry(m.name)}>Try again now</button><small>Checking again automatically every few seconds.</small></div>}
    </article>);
  return (
    <article className={"card full" + (bad ? " warn" : "") + (isOpen ? "" : " folded")} id={"m-" + m.name}>
      <div className="chead" {...head}>{chev}<i className={"dot" + (bad ? " warn" : "")} /><h3>{m.name}</h3><span className={"state" + (bad ? " warn" : "")}>{bad ? "▲ " : ""}{state}</span>
        {isOpen && d.uptime != null && <span className="up">up {uptime(d.uptime)}</span>}{isOpen && d.restart && <span className="restart" title={restartWhy(d)}>Restart needed</span>}
        {isOpen && <span className="info" tabIndex={0} role="img" aria-label="Machine details" data-tip={infoTip(d, now)} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>i</span>}
        {isOpen ? <span className="grow" /> : <CardBar d={d} h={h} bad={bad} limits={limits} />}{isOpen && <GroupsMenu name={m.name} g={groups} set={setGroups} avail={groupsFor(d, h)} />}{onHide && <MachineMenu name={m.name} onHide={onHide} />}</div>
      <Collapse open={isOpen}><GroupLayout.Provider value={groups}><MachineBody limits={limits} m={m} h={h} h2={h2} rows={rows} fc={fc} range={range} now={now} gone={gone} /></GroupLayout.Provider></Collapse>
    </article>
  );
}
export default memo(Card);
