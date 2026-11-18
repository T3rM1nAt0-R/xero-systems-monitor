import { runnerRows, STATUS_TEXT } from "./runnerList.js";
import Ticker from "./Ticker.jsx";
import { refUrl } from "./github.js";
import { linkProps, linkClass } from "./jobLink.js";
const res = v => !v ? "" : [v[0] != null && `CPU ${v[0].toFixed(0)}%`, v[1] != null && `RAM ${(v[1] / 1024).toFixed(1)} GB`, (v[2] != null || v[3] != null) && "GPU " + [v[3] != null && v[3].toFixed(0) + "%", v[2] != null && v[2].toFixed(0) + " MB"].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

export default function Jobs({ d, now, started, gone = [] }) {
  const rn = d.runners, jobs = d.jobs || {}, jr = d.jobres || {};
  if (!rn) return null;
  const rows = runnerRows(d, started, gone, now);
  return (
    <div className="rlist jobs" role="table" aria-label="Runners">
      {rows.map(r => { const j = jobs[r.name], url = j && refUrl(j[3], j[2]);
        return (
          <div key={r.name} className={"rrow" + linkClass(url)} role="row" data-tip={url ? "Open on GitHub" : [r.name, j?.[3], res(jr[r.name])].filter(Boolean).join(" · ")} {...linkProps(url)}>
            <span className={"rname " + r.status} role="cell"><i /><Ticker text={r.name} /></span><span className="rst" role="cell">{STATUS_TEXT[r.status]}</span>
            <span className="rjob" role="cell">{r.job || "–"}</span><span className="rt" role="cell">{r.inJob}</span>
          </div>); })}
    </div>
  );
}

