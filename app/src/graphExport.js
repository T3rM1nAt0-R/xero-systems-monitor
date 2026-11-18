// Saving a graph: a picture (the chart's SVG drawn onto a canvas) or its numbers as a CSV file. Both end in a browser download.
import { fileName, toCsv } from "./graphTools.js";
export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const saveCsv = (title, series) => download(new Blob([toCsv(series)], { type: "text/csv;charset=utf-8" }), fileName(title, "csv"));
const css = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;
// `chart` is the .chart element; its <svg> carries the lines. Resolves when the download has started.
export function savePng(title, chart) {
  const svg = chart.querySelector("svg"), w = chart.clientWidth, h = chart.clientHeight, pad = 40, top = 30, S = 2;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("width", w); clone.setAttribute("height", h);
  const live = svg.querySelectorAll("path");
  clone.querySelectorAll("path").forEach((p, i) => {   // the page's stylesheet does not reach a stand-alone SVG, so the look is written in (colours resolved, since var(--c-cpu) means nothing there)
    const st = p.style, cs = getComputedStyle(live[i]); p.setAttribute("fill", st.fill ? cs.fill : "none"); p.setAttribute("stroke", st.stroke ? cs.stroke : "none");
    p.setAttribute("stroke-width", "2"); p.setAttribute("stroke-linejoin", "round");
    if (p.classList.contains("cmp")) { p.setAttribute("stroke-dasharray", "5 4"); p.setAttribute("opacity", ".5"); }
    else if (st.opacity) p.setAttribute("opacity", st.opacity);
  });
  const img = new Image(), src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  return new Promise((ok, no) => {
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = (w + pad + 10) * S; c.height = (h + top + 24) * S;
      const g = c.getContext("2d"); g.scale(S, S);
      g.fillStyle = css("--s1", "#161b26"); g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = css("--fg", "#e6e9ef"); g.font = "600 14px sans-serif"; g.fillText(title, pad, 20);
      g.strokeStyle = css("--line", "#2a3142"); g.fillStyle = css("--dim", "#8b93a7"); g.font = "11px sans-serif";
      const labels = chart.querySelectorAll(".gl span");
      [0, .5, 1].forEach(q => {
        const y = top + h - q * h; g.beginPath(); g.moveTo(pad, y); g.lineTo(pad + w, y); g.stroke();
        const l = labels[q === 1 ? 1 : 0]; if (q && l) g.fillText(l.textContent, 4, y + 4);
      });
      g.drawImage(img, pad, top, w, h);
      const cr = chart.getBoundingClientRect();
      chart.parentElement.querySelectorAll(".xax span").forEach(s => { const r = s.getBoundingClientRect(); g.fillText(s.textContent, Math.max(pad, pad + r.left - cr.left), top + h + 16); });
      c.toBlob(b => { if (!b) return no(new Error("no picture")); download(b, fileName(title, "png")); ok(); }, "image/png");
    };
    img.onerror = no; img.src = src;
  });
}
