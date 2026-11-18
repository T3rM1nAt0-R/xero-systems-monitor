import { rateStr } from "../format.js";
import { containerBad } from "../alerts.js";
import { batteryFacts } from "../hwStrip.js";
// The one list of sections a machine card can show (CPU, GPU, Network, Disk, Runners, Containers & services, Terminal), and of the tabs they belong to.
// This file is pure (no React): the group order and "hide a section" choices (order.js), the Groups menu, the Ctrl+K palette and the tests all read it.
// The drawing of each section is in the file next to it (Cpu.jsx, Gpu.jsx, ...); sections/index.js joins the two.
//
// A section is { id, title, spark, def, cls, accent(m, x), available(m, h), sub(m, x), summary(m, x) }:
//   id, title  the short key (also the fold and layout key) and the name shown to people
//   spark      the history series drawn as a tiny line when the section is folded, or null
//   def, cls   open by default or not, and an extra class for the section's element
//   accent     the CSS colour variable that marks the section ("--c-cpu"); depends on the machine for services
//   available  does this machine have the section right now (m is a machine snapshot, h its graph history, may be missing)
//   sub        the small line next to the title; summary the one line shown while the section is folded
//   x          extras only the window can compute: { day: last 24 h of jobs or null, full: "full in ~3 months" or "" }
export const TABS = [["overview", "Overview"], ["hardware", "Hardware"], ["processes", "Processes"], ["disks", "Disks"], ["network", "Network"], ["services", "Services"], ["runners", "Runners"], ["logs", "Logs"], ["terminal", "Terminal"]];
export const TAB_IDS = TABS.map(t => t[0]);

const pct = v => (v != null ? v.toFixed(0) + "%" : "–");
const deg = v => (v != null ? v.toFixed(0) + "°C" : "–");
const keys = o => Object.keys(o || {}).length;
// Containers (running first, failing on top), the ones that disappeared, failed systemd units and the counts the services section shows.
export function svcFacts(m) {
  const d = m.d || {}, cs = [...(d.docker || [])].sort((x, y) => (containerBad(y) - containerBad(x)) || ((y[1] === "running") - (x[1] === "running")) || x[0].localeCompare(y[0]));
  const cgone = m.cgone || [], failed = d.failed || [], bad = cs.filter(containerBad).length + failed.length, up = cs.filter(c => c[1] === "running").length;
  return { cs, cgone, failed, bad, up };
}

export const SECTION_META = [
  { id: "cpu", title: "CPU", spark: "cpu", def: true, cls: "", accent: () => "--c-cpu", available: () => true,
    sub: m => m.d?.hw?.cpu && `${m.d.hw.cpu}${m.d.ram_gb ? ` · ${m.d.ram_gb[1].toFixed(0)} GB RAM` : ""}`,
    summary: m => `${pct(m.d?.cpu)} · ${deg(m.d?.temp)}` },
  { id: "gpu", title: "GPU", spark: "gpu", def: true, cls: "", accent: () => "--c-gpu", available: (m, h) => m.d?.gpu != null || (h?.gpu || []).some(p => p[1] > 0),
    sub: m => m.d?.hw?.gpu && `${m.d.hw.gpu}${m.d.vram_gb ? ` · ${m.d.vram_gb[1].toFixed(0)} GB` : ""}`,
    summary: m => `${pct(m.d?.gpu)} · ${deg(m.d?.gtemp)}` },
  { id: "bat", title: "Battery", spark: null, def: true, cls: "", accent: m => (batteryFacts(m.d?.bat)?.level ? "--warn" : "--c-cpu"), available: m => !!m.d?.bat,
    sub: m => batteryFacts(m.d?.bat)?.state, summary: m => { const b = batteryFacts(m.d?.bat); return b ? `${b.text} · ${b.state}` : ""; } },
  { id: "proc", title: "Processes", spark: null, def: true, cls: "full", accent: () => "--c-cpu", available: m => (m.d?.procs?.length || 0) > 0,
    sub: m => `${m.d.procs.length} busiest shown`, summary: m => m.d?.procs?.[0] ? `${m.d.procs[0][1].replace(/_/g, " ")} ${m.d.procs[0][2].toFixed(0)}%` : "" },
  { id: "net", title: "Network", spark: "down", def: false, cls: "full", accent: () => "--c-net", available: () => true,
    sub: m => { const d = m.d || {}; return d.speed > 0 && `${d.speed >= 1000 ? `${d.speed / 1000} Gbps` : `${d.speed} Mbps`} link${d.ip ? ` · ${d.ip}` : ""}`; },
    summary: m => { const d = m.d || {}; return `↓ ${d.down != null ? rateStr(d.down) : "–"}  ↑ ${d.up != null ? rateStr(d.up) : "–"}  ping ${d.ping != null ? Number(d.ping).toFixed(0) + " ms" : "–"}`; } },
  { id: "disk", title: "Disk", spark: "disk", def: true, cls: "full", accent: () => "--c-disk", available: () => true,
    sub: m => { const n = (m.d?.storage || []).length; return n > 0 && `${n} drive${n === 1 ? "" : "s"}`; },
    summary: (m, x) => `${m.d?.disk != null ? m.d.disk.toFixed(0) + "% used" : ""}${x?.full ? " · " + x.full : ""}` },
  { id: "run", title: "Runners", spark: null, def: true, cls: "runners", accent: () => "--c-run", available: m => !!m.d?.runners,
    sub: (m, x) => {
      const busy = keys(m.d?.jobs), day = x?.day;
      return `${busy} busy · ${keys(m.d?.runners) - busy} idle${day && day.done ? ` · ${day.done} jobs in 24 h${day.failed ? `, ${day.failed} failed` : ""}${day.stopped ? `, ${day.stopped} stopped` : ""}` : ""}`;
    },
    summary: m => `${keys(m.d?.jobs)} busy` },
  { id: "svc", title: "Containers & services", spark: null, def: true, cls: "full", available: m => !!(m.d?.docker || m.d?.failed?.length || m.d?.docker_err || m.d?.uptime != null),
    accent: m => (svcFacts(m).bad || m.d?.docker_err ? "--bad" : "--c-svc"),
    sub: m => { const { cs, cgone, bad, up } = svcFacts(m); return m.d?.docker_err ? "Docker blocked" : `${up} running${cs.length > up ? ` · ${cs.length - up} stopped` : ""}${bad ? ` · ${bad} failing` : ""}${cgone.length ? ` · ${cgone.length} gone` : ""}`; },
    summary: m => { const { bad, up } = svcFacts(m); return bad ? `${bad} failing` : `${up} running`; } },
  { id: "logs", title: "Logs", spark: null, def: true, cls: "full", accent: () => "--acc", available: m => m.d?.uptime != null,
    sub: () => "recent system messages", summary: () => "System log" },
  { id: "term", title: "Terminal", spark: null, def: true, cls: "full", accent: () => "--acc", available: () => true,
    sub: () => "a shell on this machine", summary: () => "Shell" },
];
export const SECTION_IDS = SECTION_META.map(s => s.id);
export const sectionTitle = id => SECTION_META.find(s => s.id === id)?.title || id;
// The ids of the sections this machine has right now, in default order.
export const availableIds = (m, h) => SECTION_META.filter(s => s.available(m, h)).map(s => s.id);
