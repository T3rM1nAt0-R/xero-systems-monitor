import { memo } from "react";
import MachineBody from "./Detail.jsx";
import CardBar from "./CardBar.jsx";
import { useCardFold, foldProps } from "./fold.js";
import { isCalm } from "./calm.js";
import { gb, uptime, isWarn, hm, hotMin, WATCH } from "./format.js";
const GENERIC = /^(system product name|to be filled|default string|not specified|unknown|none|o\.?e\.?m)/i;
const hwLine = d => d.hw && [GENERIC.test(d.hw.board || "") ? "" : d.hw.board, d.hw.os].filter(Boolean).join(" · ");
function Card({ m, h, rows, fc, range, now, lastOk, hot, gone, auto, flat, onOpen: open, onTry }) {
  const d = m.d || {};
  const off = !!m.err;
  const warnings = WATCH.filter(k => !off && isWarn(k, d[k]));
  const state = off ? `Offline` : hot.cpu ? `Working hard for ${hotMin(hot.cpu, now * 1000)} min` : warnings.length ? "Needs a look" : d.uptime != null ? `All calm · on for ${uptime(d.uptime)}` : "All calm";
  const bad = !off && (hot.cpu || warnings.length);
  const [shown, flip] = useCardFold(m.name, isCalm(m, hot, rows, now), auto), isOpen = flat || shown;   // folding is ignored inside the compact view
  const head = flat ? {} : { ...foldProps(isOpen, flip), className: "chead fold" };
  const chev = !flat && <b className="chev">{isOpen ? "▾" : "▸"}</b>;
  if (off) return (
    <article className={"card off" + (isOpen ? "" : " folded")} id={"m-" + m.name}>
      <div className="chead" {...head}>{chev}<i className="dot off" /><h3>{m.name}</h3><span className="state">Offline{lastOk ? ` since ${hm(lastOk)}` : ""}</span><button className="open" onClick={e => { e.stopPropagation(); open(m.name); }}>Open</button></div>
      {isOpen && <div className="offbox"><strong>Can&apos;t reach {m.name}</strong><span>{lastOk ? `Last heard from at ${hm(lastOk)}. ` : ""}It may be restarting, or the network dropped.</span>
        {m.d && <div className="last">{d.cpu != null && <span>Last seen: CPU {d.cpu.toFixed(0)}%</span>}{d.temp != null && <span>{d.temp.toFixed(0)}°C</span>}{d.ram_gb && <span>Memory {gb(d.ram_gb[0])} / {d.ram_gb[1].toFixed(0)} GB</span>}</div>}
        <button onClick={() => onTry(m.name)}>Try again now</button><small>Checking again automatically every few seconds.</small></div>}
    </article>);
  return (
    <article className={"card full" + (bad ? " warn" : "") + (isOpen ? "" : " folded")} id={"m-" + m.name}>
      <div className="chead" {...head}>{chev}<i className={"dot" + (bad ? " warn" : "")} /><h3>{m.name}</h3><span className={"state" + (bad ? " warn" : "")}>{bad ? "▲ " : ""}{state}</span>
        {isOpen ? <span className="meta">{[hwLine(d), d.ip].filter(Boolean).join(" · ")}</span> : <CardBar d={d} h={h} bad={bad} />}</div>
      {isOpen && <MachineBody m={m} h={h} rows={rows} fc={fc} range={range} now={now} gone={gone} />}
    </article>
  );
}
export default memo(Card);
