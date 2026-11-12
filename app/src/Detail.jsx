import { useState, useEffect, memo, useMemo } from "react";
import { setJobsAt } from "./hoverGroup.js";
import Chart from "./Chart.jsx";
import Timeline from "./Timeline.jsx";
import Jobs from "./Jobs.jsx";
import Smooth from "./Smooth.jsx";
import Busy from "./Busy.jsx";
import Trends from "./Trends.jsx";
import { jobStats, containerBad } from "./alerts.js";
import { load, save } from "./store.js";
import { gb, rateStr, since, avg, peak, isWarn, LIM } from "./format.js";
const C = { cpu: "#4ade80", temp: "#fb923c", ram: "#60a5fa", gpu: "#a78bfa", gtemp: "#fb5a72", vram: "#38bdf8", down: "#60a5fa", up: "#f472b6", ping: "#4cc9f0", disk: "#fbbf24" };
const stat = (a, f) => a.length ? `usual ${f(avg(a))} · peak ${f(peak(a))}` : "";
const lk = k => { const v = load("col." + k, null); return v == null ? null : v === 1; };   // 1 = open, 0 = shut
// A group with a clickable label. The open/closed choice is remembered per machine.
function Grp({ id, color, title, sub, summary, def = true, cls = "", children }) {
  const [open, setOpen] = useState(() => lk(id) ?? def);
  const flip = () => { setOpen(o => { save("col." + id, o ? 0 : 1); return !o; }); };
  return (
    <section className={"grp " + cls + (open ? "" : " shut")} style={{ "--g": color }}>
      <h5 onClick={flip} role="button" tabIndex={0} aria-expanded={open} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), flip())}>
        <b className="chev">{open ? "▾" : "▸"}</b>{title}{sub && <span>{sub}</span>}{!open && summary && <em>{summary}</em>}
      </h5>
      {open && children}
    </section>);
}
// One graph card. Module-level and memoised so charts keep their state between polls.
const Panel = memo(function Panel({ title, now: nv, warn, sm, k, name, pts, max, unit, fmt, thr, thrLabel, mk, t0, t1, range, group }) {
  const series = useMemo(() => [{ name: name || title, pts, color: C[k] }], [name, title, pts, k]);
  return (
    <div className="panel" style={{ "--c": C[k] }}>
      <div className="ph"><h4>{title}</h4>{nv != null && <span className={"now" + (warn ? " warn" : "")}>{nv}</span>}{sm && <span className="sum">{sm}</span>}</div>
      <Chart series={series} t0={t0} t1={t1} max={max} unit={unit} fmt={fmt} thr={thr} thrLabel={thrLabel} range={range} marks={mk} group={group} title={title} />
    </div>);
});
// One machine's stack of groups: CPU, GPU, Network, Disk, Runners. Each group is a row of graphs.
export default function MachineBody({ m, h, rows, fc, range, now, gone }) {
  const d = m.d || {}, t1 = now, t0 = t1 - range, P = k => h?.[k] || [];
  const hasGpu = d.gpu != null || P("gpu").some(p => p[1] > 0);
  const hw = d.hw || {}, drives = d.storage || [], sum = drives.reduce((a, x) => [a[0] + x[1], a[1] + x[2]], [0, 0]);
  const day = useMemo(() => d.runners ? jobStats(rows, m.name, t1 - 86400) : null, [rows, m.name, d.runners, Math.floor(t1 / 60)]);   // last 24 h, refreshed each minute
  useEffect(() => setJobsAt(m.name, t => {   // jobs that were running at moment t (for the shared hover tooltip)
    const out = rows.filter(r => r[0] === m.name && r[2] <= t && t <= r[3]).map(r => `${r[1]} · ${r[5]}${r[4] ? " (" + r[4] + ")" : ""}`);
    for (const [n, s] of Object.entries(m.started || {})) if (s <= t && d.jobs?.[n]) out.push(`${n} · ${d.jobs[n][0] || "Running"} (running)`);
    return out;
  }), [rows, m.name, m.started, d.jobs]);
  const full = fc?.days ? `full in ~${fc.days < 60 ? fc.days + " days" : Math.round(fc.days / 30) + " months"}` : "";
  const marks = useMemo(() => rows.filter(r => r[0] === m.name && r[2] >= t0).map(r => ({ t: r[2], text: `${r[1]} started: ${r[5]}` })), [rows, m.name, Math.floor(t0 / 60)]);
  const Pn = p => <Panel {...p} pts={P(p.k)} t0={t0} t1={t1} range={range} group={m.name} />;
  const big = (v, u) => v == null ? null : <>{v}<small>{u}</small></>;
  return (
    <div className="detail inline">
      <Grp id={m.name + ".cpu"} color="#4ade80" title="CPU" sub={hw.cpu && `${hw.cpu}${d.ram_gb ? ` · ${d.ram_gb[1].toFixed(0)} GB RAM` : ""}`} summary={`${d.cpu != null ? d.cpu.toFixed(0) + "%" : "–"} · ${d.temp != null ? d.temp.toFixed(0) + "°C" : "–"}`}><div className="dgrid">
        <Pn title="CPU" k="cpu" now={big(d.cpu?.toFixed(0), "%")} warn={isWarn("cpu", d.cpu)} sm={stat(P("cpu"), v => v.toFixed(0) + "%")} max={100} unit="%" thr={LIM.cpu} thrLabel="High above 90%" mk={marks} />
        <Pn title="CPU temp" k="temp" now={big(d.temp?.toFixed(0), "°C")} warn={isWarn("temp", d.temp)} max={100} unit="°C" thr={LIM.temp} thrLabel="Warm above 80°C" />
        <Pn title="Memory" k="ram" now={d.ram_gb ? big(gb(d.ram_gb[0]), `/ ${d.ram_gb[1].toFixed(0)} GB`) : big(d.ram?.toFixed(0), "%")} warn={isWarn("ram", d.ram)} max={100} unit="%" />
      </div>
      {d.top?.length > 0 && <div className="procs"><h4>Busiest programs now</h4>{d.top.slice(0, 5).map(([n, c, r, k]) => <div className="prow" key={n}><b data-tip={n.replace(/_/g, " ")}>{n.replace(/_/g, " ")}{k > 1 ? ` ×${k}` : ""}</b><span className="meter"><i style={{ width: Math.min(100, c * 2) + "%" }} /></span><span>{c.toFixed(c < 10 ? 1 : 0)}%</span><span>{r >= 1024 ? (r / 1024).toFixed(1) + " GB" : Math.round(r) + " MB"}</span></div>)}</div>}</Grp>
      {hasGpu && <Grp id={m.name + ".gpu"} color="#a78bfa" title="GPU" sub={hw.gpu && `${hw.gpu}${d.vram_gb ? ` · ${d.vram_gb[1].toFixed(0)} GB` : ""}`} summary={`${d.gpu != null ? d.gpu.toFixed(0) + "%" : "–"} · ${d.gtemp != null ? d.gtemp.toFixed(0) + "°C" : "–"}`}><div className="dgrid">
        <Pn title="GPU" k="gpu" now={big(d.gpu?.toFixed(0), "%")} sm={stat(P("gpu"), v => v.toFixed(0) + "%")} max={100} unit="%" />
        <Pn title="GPU temp" k="gtemp" now={big(d.gtemp?.toFixed(0), "°C")} warn={isWarn("gtemp", d.gtemp)} max={100} unit="°C" thr={LIM.gtemp} thrLabel="Warm above 80°C" />
        <Pn title="GPU memory" k="vram" now={d.vram_gb ? big(gb(d.vram_gb[0]), `/ ${d.vram_gb[1].toFixed(0)} GB`) : big(d.vram?.toFixed(0), "%")} max={100} unit="%" />
      </div></Grp>}
      <Grp id={m.name + ".net"} cls="full" color="#60a5fa" def={false} title="Network" sub={d.speed > 0 && `${d.speed >= 1000 ? `${d.speed / 1000} Gbps` : `${d.speed} Mbps`} link${d.ip ? ` · ${d.ip}` : ""}`} summary={`↓ ${d.down != null ? rateStr(d.down) : "–"}  ↑ ${d.up != null ? rateStr(d.up) : "–"}  ping ${d.ping != null ? Number(d.ping).toFixed(0) + " ms" : "–"}`}><div className="dgrid">
        <Pn title="Download" k="down" now={d.down != null ? rateStr(d.down) : null} fmt={rateStr} />
        <Pn title="Upload" k="up" now={d.up != null ? rateStr(d.up) : null} fmt={rateStr} />
        <Pn title="Ping" k="ping" now={big(d.ping != null ? Number(d.ping).toFixed(0) : null, "ms")} sm={h?.loss != null ? `${h.loss.toFixed(1)}% lost` : ""} unit=" ms" />
      </div></Grp>
      <Grp id={m.name + ".disk"} cls="full" color="#fbbf24" title="Disk" sub={drives.length > 0 && `${drives.length} drive${drives.length === 1 ? "" : "s"}`} summary={`${d.disk != null ? d.disk.toFixed(0) + "% used" : ""}${full ? " · " + full : ""}`}><div className="panel diskcard" style={{ "--c": C.disk }}>
          <div className="ph"><h4>Disk use</h4>{d.disk != null && <span className="now">{d.disk.toFixed(0)}<small>%</small></span>}{drives.length > 0 && <span className="sum">{gb(sum[0])} of {sum[1].toFixed(0)} GB used</span>}{full && <span className={"sum fc" + (fc.days < 30 ? " warn" : "")} data-tip={`A straight line through the last 30 days: +${fc.per_day}% of the disk per day`}>{full}</span>}</div>
          <Chart series={[{ name: "Disk use", pts: P("disk"), color: C.disk }]} t0={t0} t1={t1} max={100} unit="%" range={range} group={m.name} title="Disk use" />
          <div className="drives">
            {drives.length ? drives.map(([n, u, t]) => <div className="drive" key={n}><span data-tip={n}>{n}</span><span className={"meter" + (u / t > .9 ? " crit" : u / t > .75 ? " warn" : "")}><i style={{ width: Math.min(100, 100 * u / t) + "%" }} /></span><em>{gb(u)} / {t.toFixed(0)} GB</em></div>) : <div className="quiet">No drive information yet.</div>}
          </div>
        </div>
      </Grp>
      {d.runners && <Grp id={m.name + ".run"} color="#4cc9f0" cls="runners" title="Runners" sub={`${Object.keys(d.jobs || {}).length} busy · ${Object.keys(d.runners).length - Object.keys(d.jobs || {}).length} idle${day && day.done ? ` · ${day.done} jobs in 24 h${day.failed ? `, ${day.failed} failed` : ""}${day.stopped ? `, ${day.stopped} stopped` : ""}` : ""}`} summary={`${Object.keys(d.jobs || {}).length} busy`}>
        <Smooth className="panel wide">
          <Jobs d={d} now={t1} started={m.started} gone={gone} />
          <Timeline machine={m.name} rows={rows} runners={d.runners} jobs={d.jobs} started={m.started} t0={t0} t1={t1} range={range} />
          <Trends rows={rows} machine={m.name} now={t1} />
          <Busy rows={rows} machine={m.name} count={Object.keys(d.runners).length} running={Object.values(m.started || {})} now={t1} />
        </Smooth></Grp>}
      {(d.docker || d.failed?.length > 0) && (() => {   // Docker containers (running first, failing on top), ones that disappeared, and failed systemd units
        const cs = [...(d.docker || [])].sort((x, y) => (containerBad(y) - containerBad(x)) || ((y[1] === "running") - (x[1] === "running")) || x[0].localeCompare(y[0]));
        const gone = m.cgone || [], failed = d.failed || [], bad = cs.filter(containerBad).length + failed.length, up = cs.filter(c => c[1] === "running").length;
        const sub = d.docker_err ? "Docker blocked" : `${up} running${cs.length > up ? ` · ${cs.length - up} stopped` : ""}${bad ? ` · ${bad} failing` : ""}${gone.length ? ` · ${gone.length} gone` : ""}`;
        return <Grp id={m.name + ".svc"} color={bad || d.docker_err ? "#fb5a72" : "#4ade80"} title="Containers & services" sub={sub} summary={bad ? `${bad} failing` : `${up} running`}>
          <div className="panel wide svc">
            {d.docker_err && <div className="svcnote" role="alert">Docker is installed here but would not answer: <code>{d.docker_err}</code> The ssh user probably needs to be in the docker group.</div>}
            {failed.map(u => <div className="svcrow bad" key={"f" + u}><i /><b>{u}</b><span className="st">failed</span><span className="sub">systemd service</span></div>)}
            {cs.map(([n, st, text, img, ports, ago]) => <div className={"svcrow" + (containerBad([n, st, text]) ? " bad" : st === "running" ? " up" : "")} key={n}>
              <i /><b data-tip={n}>{n}</b><span className="st">{text}</span><span className="sub" data-tip={[img, ports, ago && "created " + ago].filter(Boolean).join(" · ")}>{[img, ports].filter(Boolean).join(" · ")}</span></div>)}
            {gone.map(([n, t, , text, img]) => <div className="svcrow gone" key={"g" + n}><i /><b data-tip={n}>{n}</b><span className="st">gone {since(t)} ago</span><span className="sub">was: {text}{img ? " · " + img : ""}</span></div>)}
            {!cs.length && !gone.length && !failed.length && !d.docker_err && <div className="quiet">No containers on this machine right now.</div>}
          </div></Grp>; })()}
    </div>
  );
}
