// Running as administrator, the pure side: which rows the Terminal tab's "Admin shell…" menu and the More menu show.
// `sudo` is what the shell reports about Windows sudo: "missing", "not_inline" or "inline".
export const ADMIN_NOTE = "Admin shells can change anything on this PC.";
export const SUDO_HINT = "Turn on sudo 'Inline' in Windows Settings › System › For developers";
// The menu rows for a not-elevated app; an elevated app needs no menu (every local tab shows the Admin badge instead).
export function adminRows({ elevated, sudo }) {
  if (elevated) return [];
  const tab = { id: "tab", label: "In this tab (Windows sudo)" };
  return [
    ...(sudo === "inline" ? [tab] : sudo === "not_inline" ? [{ ...tab, disabled: true, hint: SUDO_HINT }] : []),
    { id: "window", label: "Separate admin window" },
    { id: "restart", label: "Restart Xero as admin" },
  ];
}
// The two More-menu rows: a button (disabled when already admin) and the "always" tick.
export const moreAdminRows = prefs => [
  { id: "restart", label: prefs.elevated ? "Running as admin" : "Restart as admin", disabled: !!prefs.elevated },
  { id: "always", label: "Always start as admin", on: !!prefs.alwaysAdmin },
];
// Run an admin command; a "no" to the Windows question is a quiet "Cancelled" toast and anything else says why.
export const asAdmin = (call, toast) => call().catch(e => toast(e === "Cancelled" || e?.message === "Cancelled" ? "Cancelled" : String(e?.message || e)));
export const START_CANCELLED = "Started without admin (cancelled)";
