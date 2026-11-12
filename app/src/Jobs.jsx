import { dur, prOf } from "./format.js";
import Ticker from "./Ticker.jsx";
const res = v => !v ? "" : [v[0] != null && `CPU ${v[0].toFixed(0)}%`, v[1] != null && `RAM ${(v[1] / 1024).toFixed(1)} GB`, (v[2] != null || v[3] != null) && "GPU " + [v[3] != null && v[3].toFixed(0) + "%", v[2] != null && v[2].toFixed(0) + " MB"].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

export default function Jobs({ d, now, started, gone = [] }) {
  const rn = d.runners, jobs = d.jobs || {}, jr = d.jobres || {};
  if (!rn) return null;
  const run = Object.keys(jobs);
  const names = [...Object.keys(rn), ...gone.filter(g => !(g in rn))].sort();
  return (
    <div className="jobs">
      <div className="chips">{names.map(n => { const st = !(n in rn) ? "gone" : (n in jobs || rn[n]) ? "busy" : "idle"; return <span key={n} className={"chip " + st} data-tip={st === "gone" ? n + " is not reporting" : st === "busy" ? n + " is working" : n + " is idle"}><i /><Ticker text={n} /></span>; })}</div>
      {run.map(n => { const j = jobs[n], t = started?.[n];
        return (
          <div key={n} className="job">
            <span><b>{j[0] || "Running"}</b> {prOf(j[2]) && <span className="pr">{prOf(j[2])}</span>}</span><span className="t">{t ? dur(now - t) : ""}</span>
            <Ticker className="s" text={[n, j[3], res(jr[n])].filter(Boolean).join(" · ")} />
          </div>); })}
    </div>
  );
}

