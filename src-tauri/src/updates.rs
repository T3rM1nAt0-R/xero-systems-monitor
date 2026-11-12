//! Updates from GitHub Releases (`latest.json`) through the Tauri updater.
//!
//! Mapping to the window's contract:
//! - `check`: an update is waiting `true`; up to date `false`; any error (offline, bad key, no release) `null`.
//! - `apply`: installed `true` (the window then offers a restart); any failure `false`.
//!   `"dirty"` is never sent: an installed app has no local edits to protect (that case belonged to the git-based updater).

use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, kept for `apply`.
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

impl Pending {
    fn put(&self, update: Option<Update>) {
        if let Ok(mut slot) = self.0.lock() {
            *slot = update;
        }
    }

    fn take(&self) -> Option<Update> {
        self.0.lock().ok().and_then(|mut slot| slot.take())
    }
}

async fn find(app: &AppHandle) -> Result<Option<Update>, tauri_plugin_updater::Error> {
    app.updater()?.check().await
}

/// Ask GitHub whether a newer version exists.
pub async fn check(app: &AppHandle, pending: &Pending) -> Option<bool> {
    let found = find(app).await.ok()?;
    let waiting = found.is_some();
    pending.put(found);
    Some(waiting)
}

/// Download and install the waiting update (checking again when none is kept).
pub async fn apply(app: &AppHandle, pending: &Pending) -> bool {
    let update = match pending.take() {
        Some(update) => update,
        None => match find(app).await {
            Ok(Some(update)) => update,
            _ => return false,
        },
    };
    update.download_and_install(|_, _| {}, || {}).await.is_ok()
}

/// What `get_version` answers.
#[derive(Debug, serde::Serialize)]
pub struct Build {
    /// The crate version.
    pub version: &'static str,
    /// Unix seconds the app was built; 0 when unknown.
    pub date: u64,
    /// True for an installed build.
    pub packaged: bool,
}

/// The running version and its build date.
#[must_use]
pub fn version() -> Build {
    Build {
        version: env!("CARGO_PKG_VERSION"),
        date: option_env!("XSM_BUILD_DATE")
            .and_then(|d| d.parse().ok())
            .unwrap_or(0),
        packaged: !cfg!(debug_assertions),
    }
}
