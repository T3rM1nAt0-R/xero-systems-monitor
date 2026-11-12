import { memo } from "react";
import MachineBody from "./Detail.jsx";
import { gb, uptime, isWarn, hm, hotMin, WATCH } from "./format.js";
const GENERIC = /^(system product name|to be filled|default string|not specified|unknown|none|o\.?e\.?m)/i;
const hwLine = d => d.hw && [GENERIC.test(d.hw.board || "") ? "" : d.hw.board, d.hw.os].filter(Boolean).join(" · ");
function Card({ m, h, rows, fc, range, now, lastOk, hot, gone, onOpen: open, onTry }) {
  const d = m.d || {};
  const off = !!m.err;
  const warnings = WATCH.filter(k => !off && isWarn(k, d[k]));
  const state = off ? `Offline` : hot.cpu ? `Working hard for ${hotMin(hot.cpu, now * 1000)} min` : warnings.length ? "Needs a look" : d.uptime != null ? `All calm · on for ${uptime(d.uptime)}` : "All calm";
  const bad = !off && (hot.cpu || warnings.length);
  if (off) return (
    <article className="card off" id={"m-" + m.name}>
      <div className="chead"><i className="dot off" /><h3>{m.name}</h3><span className="state">Offline{lastOk ? ` since ${hm(lastOk)}` : ""}</span><button className="open" onClick={() => open(m.name)}>Open</button></div>
      <div className="offbox"><strong>Can&apos;t reach {m.name}</strong><span>{lastOk ? `Last heard from at ${hm(lastOk)}. ` : ""}It may be restarting, or the network dropped.</span>
        {m.d && <div className="last">{d.cpu != null && <span>Last seen: CPU {d.cpu.toFixed(0)}%</span>}{d.temp != null && <span>{d.temp.toFixed(0)}°C</span>}{d.ram_gb && <span>Memory {gb(d.ram_gb[0])} / {d.ram_gb[1].toFixed(0)} GB</span>}</div>}
        <button onClick={() => onTry(m.name)}>Try again now</button><small>Checking again automatically every few seconds.</small></div>
    </article>);
  return (
    <article className={"card full" + (bad ? " warn" : "")} id={"m-" + m.name}>
      <div className="chead"><i className={"dot" + (bad ? " warn" : "")} /><h3>{m.name}</h3><span className={"state" + (bad ? " warn" : "")}>{bad ? "▲ " : ""}{state}</span>
        <span className="meta">{[hwLine(d), d.ip].filter(Boolean).join(" · ")}</span></div>
      <MachineBody m={m} h={h} rows={rows} fc={fc} range={range} now={now} gone={gone} />
    </article>
  );
}
export default memo(Card);
