// Links to GitHub for jobs. Pure, so it is tested. Only https://github.com/ addresses are ever made.
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
export const GITHUB = "https://github.com/";
// "owner/name" with both parts plain GitHub names (no dots-only parts, no slashes, no spaces).
export const repoOk = repo => {
  const p = typeof repo === "string" ? repo.split("/") : [];
  return p.length === 2 && p.every(x => NAME.test(x) && !/^\.+$/.test(x));
};
// The pull request number in a ref like refs/pull/12/merge, or null.
export const prNumber = ref => { const m = /^refs\/pull\/(\d{1,9})\//.exec(ref || ""); return m ? +m[1] : null; };
// The best page for a job: its pull request, else the repository's Actions page. Null when the repo is not usable.
export function jobUrl(repo, pr) {
  if (!repoOk(repo)) return null;
  return pr != null && Number.isInteger(+pr) && +pr > 0 ? `${GITHUB}${repo}/pull/${+pr}` : `${GITHUB}${repo}/actions`;
}
export const refUrl = (repo, ref) => jobUrl(repo, prNumber(ref));
// From a label or an Activity line: "PR #7 · branch · Build (owner/name)".
export function labelUrl(text) {
  const s = String(text || ""), repo = /\(([^()\s]+)\)\s*$/.exec(s), pr = /\bPR #(\d{1,9})\b/.exec(s);
  return repo ? jobUrl(repo[1], pr ? +pr[1] : null) : null;
}
// The same check the app shell makes before it opens anything.
export const isGithubUrl = u => typeof u === "string" && u.startsWith(GITHUB) && /^[A-Za-z0-9._\-/]+$/.test(u.slice(GITHUB.length));
