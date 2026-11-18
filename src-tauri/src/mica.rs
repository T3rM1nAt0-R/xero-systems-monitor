//! The optional "Mica behind glass" backdrop of the main window (Windows 11 only).
//! Anywhere else, or when Windows refuses, the window stays opaque and the caller is told so.

use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Manager};

/// Switch the Mica backdrop on or off. Returns whether it is showing now.
///
/// # Errors
/// Text when the window is gone. A system that cannot draw Mica (before Windows 11) is not an
/// error: the answer is `false` and the window stays opaque.
pub fn set(app: &AppHandle, on: bool) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "the window is not open".to_owned())?;
    let effects = on.then(|| EffectsBuilder::new().effect(Effect::Mica).build());
    Ok(window.set_effects(effects).is_ok() && on)
}
