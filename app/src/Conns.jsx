// "Network connections by program": how many TCP connections and UDP sockets each program has open (This PC, Windows).
// This counts connections, not data: Windows only tells the bytes per program to an administrator, and the monitor never asks for that.
export default function Conns({ list }) {
  const top = Math.max(1, ...list.map(c => c[1]));
  return (
    <div className="procs conns"><h4 data-tip="TCP connections and UDP sockets open right now, not how much data they carry">Network connections by program</h4>
      {list.map(([n, c]) => <div className="crow" key={n}><b data-tip={n.replace(/_/g, " ")}>{n.replace(/_/g, " ")}</b><span className="meter"><i style={{ width: (100 * c / top) + "%" }} /></span><span>{c}</span></div>)}
    </div>);
}
