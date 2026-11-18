import ContainerActions from "../ContainerActions.jsx";
import { containerBad } from "../alerts.js";
import { since } from "../format.js";
import { svcFacts } from "./meta.js";
// The Containers & services section: Docker containers (running first, failing on top), ones that disappeared, and failed systemd units.
export default function Services({ m, d }) {
  const { cs, cgone, failed } = svcFacts(m);
  return (
    <div className="panel wide svc">
      {d.docker_err && <div className="svcnote" role="alert">Docker is installed here but would not answer: <code>{d.docker_err}</code> The ssh user probably needs to be in the docker group.</div>}
      {failed.map(u => <div className="svcrow bad" key={"f" + u}><i /><b>{u}</b><span className="st">failed</span><span className="sub">systemd service</span></div>)}
      {cs.map(([n, st, text, img, ports, ago]) => <div className={"svcrow" + (containerBad([n, st, text]) ? " bad" : st === "running" ? " up" : "")} key={n}>
        <i /><b data-tip={n}>{n}</b><span className="st">{text}</span><span className="sub" data-tip={[img, ports, ago && "created " + ago].filter(Boolean).join(" · ")}>{[img, ports].filter(Boolean).join(" · ")}</span><ContainerActions machine={m.name} name={n} running={st === "running"} /></div>)}
      {cgone.map(([n, t, , text, img]) => <div className="svcrow gone" key={"g" + n}><i /><b data-tip={n}>{n}</b><span className="st">gone {since(t)} ago</span><span className="sub">was: {text}{img ? " · " + img : ""}</span></div>)}
      {!cs.length && !cgone.length && !failed.length && !d.docker_err && <div className="quiet">No containers on this machine right now.</div>}
    </div>);
}
