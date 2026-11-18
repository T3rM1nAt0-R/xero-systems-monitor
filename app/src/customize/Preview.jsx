import { graphOf } from "../theme/model.js";
import { seriesPaths } from "../theme/graphStyle.js";
const W = 300, H = 60, SAMPLE = [14, 22, 18, 35, 52, 44, 60, 41, 38, 55, 70, 48, 36, 42, 30, 45];
const LIMIT = 80;   // where the sample limit line sits, in percent
// A made-up machine card that uses the same classes and variables as the real ones, so it shows the look as it is now.
export default function Preview({ look }) {
  const g = graphOf(look), x = i => (i / (SAMPLE.length - 1)) * W, y = v => H - (v / 100) * H;
  const p = seriesPaths(SAMPLE.map((v, i) => [i, v]), { x: i => x(i), y, bottom: H, style: g.style, smooth: g.smooth });
  return (
    <div className="cprev" aria-label="Preview">
      <article className="card full" style={{ "--mc": "var(--c-ram)", "--edge": "calc(3px * var(--scale))" }}>
        <div className="chead"><i className="dot" /><h3>example-server</h3><span className="state">All calm</span></div>
        <div className="detail">
          <section className="grp"><h5>CPU <span>8 cores</span></h5>
            <div className="fsub"><h4>Cores <em>8 of 8</em></h4></div>
            <div className="panel" style={{ "--c": "var(--c-cpu)" }}>
              <div className="ph"><h4><span className="ttl">CPU use</span></h4><span className="now">45<small>%</small></span><span className="sum">3.2 GHz</span></div>
              <div className="chart">
                {[1, 2, 3].map(i => <i key={i} className="vg" style={{ left: i * 25 + "%" }} />)}
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  {p.a && <path d={p.a} style={{ fill: "var(--c-cpu)", stroke: "none", opacity: "var(--area-op)" }} />}
                  <path d={p.l} className={g.style === "bars" ? "bars" : undefined} style={g.style === "bars" ? { fill: "var(--c-cpu)" } : { stroke: "var(--c-cpu)" }} />
                </svg>
                <div className="thr" style={{ bottom: LIMIT + "%" }}><span>limit {LIMIT}%</span></div>
              </div>
            </div>
          </section>
          <p className="cprev-note"><span className="amber">Needs a look</span> <span className="quiet">· Disk is almost full</span></p>
        </div>
      </article>
    </div>);
}
