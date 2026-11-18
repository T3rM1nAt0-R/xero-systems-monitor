import { jobName } from "./trends.js";
import { labelUrl } from "./github.js";
// The job history list: finished-job rows [machine, runner, start, end, result, label] of one machine, newest first.
export const HISTORY_MAX = 100;
// The list first shows HISTORY_FIRST jobs; "Show more" adds HISTORY_MORE each time.
export const HISTORY_FIRST = 15, HISTORY_MORE = 25;
const KINDS = { Succeeded: "succeeded", Failed: "failed", Canceled: "stopped", Cancelled: "stopped", Abandoned: "stopped" };
export const resultKind = res => KINDS[res] || "unknown";
export const RESULT_FILTERS = [["all", "All results"], ["failed", "Failed"], ["succeeded", "Succeeded"], ["stopped", "Stopped"]];
export function historyRows(rows, machine, limit = HISTORY_MAX) {
  return rows.filter(r => r[0] === machine).sort((a, b) => b[3] - a[3]).slice(0, limit)
    .map(([, runner, t0, t1, res, label]) => ({ runner, t0, t1, res: res || "", kind: resultKind(res), label, flow: jobName(label), url: labelUrl(label) }));
}
export const workflowsOf = list => [...new Set(list.map(j => j.flow))].sort((a, b) => a.localeCompare(b));
// q: words that must all appear in the label, runner or result; kind: "all" or a result kind; flow: "" or a workflow name.
export function filterHistory(list, { q = "", kind = "all", flow = "" } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(j => (kind === "all" || j.kind === kind) && (!flow || j.flow === flow)
    && words.every(w => `${j.label} ${j.runner} ${j.res}`.toLowerCase().includes(w)));
}
