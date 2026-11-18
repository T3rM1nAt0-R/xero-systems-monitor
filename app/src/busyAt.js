// "What was busy then?": turns the get_busy_at answer into the rows the popover shows.
// The answer is { t, top: [name, cpu %, memory MB, count][] }, or {} when nothing was kept for that time.
export const memText = mb => (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB");
export const cpuText = c => c.toFixed(c < 10 ? 1 : 0) + "%";
export function busyRows(reply, max = 10) {
  return (reply?.top || []).slice(0, max).map(([name, cpu, mb, count]) => ({
    name: name.replace(/_/g, " ") + (count > 1 ? ` ×${count}` : ""), cpu: cpuText(cpu), mem: memText(mb),
  }));
}
// One line for a tooltip or a screen reader: "chrome 32% · 2.1 GB, editor 4.0% · 900 MB"
export const busyLine = (reply, max = 3) => busyRows(reply, max).map(r => `${r.name} ${r.cpu} · ${r.mem}`).join(", ");
