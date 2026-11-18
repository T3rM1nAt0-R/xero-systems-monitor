import { useEffect, useMemo, useRef } from "react";
import { ZoomChip } from "./GraphTools.jsx";
import { useZoom } from "./graphView.js";
import { setJobsAt } from "./hoverGroup.js";
import { jobStats } from "./alerts.js";
import { DEFAULT_LIMITS } from "./limits.js";
import { NONE } from "./consts.js";
import Panel from "./Panel.jsx";
import Grp from "./sections/Grp.jsx";
import Tabs, { panelId, tabId } from "./Tabs.jsx";
import { SECTIONS } from "./sections/index.js";
import { availableTabs, effectiveTab, tabParts } from "./sections/tabs.js";
import { useMachineSettings, togglePinned } from "./machineSettings.js";
import { graphShown, graphClass } from "./graphPrefs.js";
import { autoMarks } from "./marks.js";
import { unusualNow, UNUSUAL_KEYS } from "./unusual.js";
import useWeek from "./useWeek.js";
import OutageStrip from "./OutageStrip.jsx";
// One machine's body: the sections it has, drawn from the registry (sections/index.js) in the order the Grp layout gives them.
// This component owns what every section shares: the time window, the graph panel helper `Pn`, the job marks and the 24 h job numbers.
export default function MachineBody({ m, h, h2, rows, fc, range, now, gone, limits = DEFAULT_LIMITS }) {
  const [settings, patch] = useMachineSettings(m.name), tab = effectiveTab(settings.tab, m, h), base = "t-" + m.name;   // settings: this machine's remembered tab and pinned sections
  const zoom = useZoom(m.name), d = m.d || {}, t1 = zoom ? zoom[1] : now, t0 = zoom ? zoom[0] : now - range, span = t1 - t0, live = !zoom, P = k => h?.[k] || NONE;
  const t1Min = Math.floor(t1 / 60), t0Min = Math.floor(t0 / 60);   // the lists below only need refreshing once a minute
  const day = useMemo(() => d.runners ? jobStats(rows, m.name, t1 - 86400) : null, [rows, m.name, d.runners, t1Min]);   // eslint-disable-line react-hooks/exhaustive-deps -- last 24 h, refreshed each minute, not each poll
  useEffect(() => setJobsAt(m.name, t => {   // jobs that were running at moment t (for the shared hover tooltip)
    const out = rows.filter(r => r[0] === m.name && r[2] <= t && t <= r[3]).map(r => `${r[1]} · ${r[5]}${r[4] ? " (" + r[4] + ")" : ""}`);
    for (const [n, s] of Object.entries(m.started || {})) if (s <= t && d.jobs?.[n]) out.push(`${n} · ${d.jobs[n][0] || "Running"} (running)`);
    return out;
  }), [rows, m.name, m.started, d.jobs]);
  const full = fc?.days ? `full in ~${fc.days < 60 ? fc.days + " days" : Math.round(fc.days / 30) + " months"}` : "";
  const { week, events } = useWeek(m.name), nowMin = Math.floor(now / 60);
  const marks = useMemo(() => autoMarks({ events, rows, machine: m.name, uptime: d.uptime, now, t0, t1 }), [events, rows, m.name, d.uptime != null, nowMin, t0Min]);   // eslint-disable-line react-hooks/exhaustive-deps -- the marks only move once a minute
  // Pn must keep one identity between renders (a new component type would remount every card on each poll and close the "What was busy then?" box); it reads the latest values from a ref.
  const pc = useRef(); pc.current = { P, h2, t0, t1, span, live, name: m.name, loading: !h, graphs: settings.graphs, onOverview: tab === "overview", marks, d, week, now };
  const Pn = useRef(p => { const c = pc.current; if (c.onOverview && !graphShown(c.graphs, p.k)) return null;   // the "Graphs on Overview" choice
    const un = UNUSUAL_KEYS.includes(p.k) ? unusualNow(c.d[p.k], c.week?.[p.k], c.now) : null;
    return <Panel {...p} cls={(p.cls || "") + " " + graphClass(c.graphs, p.k)} mk={p.mk || c.marks} usual={un ? Math.round(un.usual) : null} pts={c.P(p.k)} old={c.h2?.[p.k]} t0={c.t0} t1={c.t1} range={c.span} live={c.live} loading={c.loading} group={c.name} />; }).current;
  // What a section can read: the machine, its numbers and history, the time window, and the helpers above.
  const x = { m, d, h, h2, rows, fc, range, now, gone, limits, settings, t0, t1, span, live, P, Pn, marks, day, full };
  return (
    <div className="detail">
      <ZoomChip machine={m.name} span={zoom} />
      <Tabs tabs={availableTabs(m, h, tab)} tab={tab} onTab={t => patch({ tab: t })} base={base} />
      {tab === "overview" && <OutageStrip machine={m.name} events={events} pts={week?.cpu || NONE} now={now} offNow={!!m.err} span={settings.strip} onSpan={strip => patch({ strip })} />}
      <div className="tabpanel" key={tab} role="tabpanel" id={panelId(base)} aria-labelledby={tabId(base, tab)}>
        {tabParts(tab, m, h, settings.pinned).map(([id, view]) => { const s = SECTIONS.find(z => z.id === id); return (
          <Grp key={id} id={m.name + "." + id} color={`var(${s.accent(m)})`} title={s.title} sub={s.sub(m, x)} summary={s.summary(m, x)} spark={s.spark ? P(s.spark) : undefined} def={s.def} cls={s.cls} pinned={settings.pinned.includes(id)} onPin={() => patch({ pinned: togglePinned(settings, id).pinned })}>
            <s.Component {...x} view={view} />
          </Grp>); })}
      </div>
    </div>
  );
}
