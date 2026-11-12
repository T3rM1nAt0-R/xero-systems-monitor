//! Small settings the shell needs before the window exists, kept as JSON in the app data folder.
//! `closeToTray` is stored here; `login` is whatever the operating system says (autostart).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

const FILE: &str = "prefs.json";

/// What `get_prefs` and `set_prefs` answer (`Prefs` in `docs/window-api.md`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Prefs {
    /// Closing the window hides it to the tray.
    pub close_to_tray: bool,
    /// Start with Windows (hidden, in the tray).
    pub login: bool,
    /// True for an installed build, false for a development run.
    pub packaged: bool,
}

/// The part of `set_prefs` that can change.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefsPatch {
    /// New close-to-tray value.
    pub close_to_tray: Option<bool>,
    /// New start-with-Windows value.
    pub login: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Stored {
    close_to_tray: bool,
}

impl Default for Stored {
    fn default() -> Self {
        Self {
            close_to_tray: true,
        }
    }
}

/// The stored prefs and where they live.
pub struct PrefsStore {
    path: PathBuf,
    stored: Mutex<Stored>,
}

impl PrefsStore {
    /// Read the file (a missing or broken file means the defaults).
    pub fn load(app: &AppHandle) -> Self {
        let path = crate::data_dir(app).unwrap_or_default().join(FILE);
        let stored = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            path,
            stored: Mutex::new(stored),
        }
    }

    /// True when closing the window should hide it.
    pub fn close_to_tray(&self) -> bool {
        self.stored.lock().map_or(true, |s| s.close_to_tray)
    }

    fn set_close_to_tray(&self, on: bool) -> Result<(), String> {
        let mut stored = self.stored.lock().map_err(|e| e.to_string())?;
        stored.close_to_tray = on;
        let text = serde_json::to_string(&*stored).map_err(|e| e.to_string())?;
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let temp = self.path.with_extension("tmp");
        std::fs::write(&temp, text).map_err(|e| e.to_string())?;
        std::fs::rename(&temp, &self.path).map_err(|e| e.to_string())
    }
}

/// The prefs as they are now.
///
/// # Errors
/// Text when the autostart setting cannot be read.
pub fn get(app: &AppHandle) -> Result<Prefs, String> {
    let store = app.state::<PrefsStore>();
    Ok(Prefs {
        close_to_tray: store.close_to_tray(),
        login: app.autolaunch().is_enabled().map_err(|e| e.to_string())?,
        packaged: !cfg!(debug_assertions),
    })
}

/// Apply the changes in `patch`, then answer the new prefs.
///
/// # Errors
/// Text when a setting cannot be saved.
pub fn set(app: &AppHandle, patch: &PrefsPatch) -> Result<Prefs, String> {
    if let Some(on) = patch.login {
        let launch = app.autolaunch();
        let done = if on {
            launch.enable()
        } else {
            launch.disable()
        };
        done.map_err(|e| e.to_string())?;
    }
    if let Some(on) = patch.close_to_tray {
        app.state::<PrefsStore>().set_close_to_tray(on)?;
    }
    get(app)
}
