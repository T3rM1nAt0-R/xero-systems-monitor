//! The main window's behaviour: normal and mini mode, pinning, theme, show/hide and closing.

use crate::prefs::PrefsStore;
use crate::tray;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Theme, WebviewWindow, WindowEvent,
};

/// Label of the one window.
const MAIN: &str = "main";
/// Mini window size and its gap to the screen corner, CSS pixels.
const MINI_WIDTH: f64 = 300.0;
const MINI_HEIGHT: f64 = 260.0;
const MINI_MIN_WIDTH: f64 = 240.0;
const MINI_MIN_HEIGHT: f64 = 80.0;
const CORNER_GAP: f64 = 12.0;
/// Smallest normal window, CSS pixels.
const MIN_WIDTH: f64 = 360.0;
const MIN_HEIGHT: f64 = 400.0;

/// The three window modes of `set_window_mode`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// The small always-on-top corner window.
    Mini,
    /// The normal window.
    Full,
    /// The normal window with one row per machine.
    Compact,
}

/// Size and place to come back to when mini mode ends.
#[derive(Clone, Copy)]
struct Saved {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    maximized: bool,
}

struct Inner {
    mode: Mode,
    pinned: bool,
    saved: Option<Saved>,
    quitting: bool,
}

/// Window state shared by the commands, the tray and the close handler.
pub struct Frame(Mutex<Inner>);

impl Default for Frame {
    fn default() -> Self {
        // The window starts pinned, like its own saved default.
        Self(Mutex::new(Inner {
            mode: Mode::Full,
            pinned: true,
            saved: None,
            quitting: false,
        }))
    }
}

impl Frame {
    fn with<T>(&self, f: impl FnOnce(&mut Inner) -> T) -> Option<T> {
        self.0.lock().ok().map(|mut inner| f(&mut inner))
    }

    /// True while the mini window is showing.
    pub fn is_mini(&self) -> bool {
        self.with(|i| i.mode == Mode::Mini).unwrap_or(false)
    }

    /// True while the window is pinned (always on top).
    pub fn is_pinned(&self) -> bool {
        self.with(|i| i.pinned).unwrap_or(false)
    }
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN)
        .ok_or_else(|| "the window is not open".to_owned())
}

/// Whole screen pixels from a measure; window sizes are small and never negative.
fn px(v: f64) -> u32 {
    // reason: the value is a window size, far inside the range of u32
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let n = v.max(0.0) as u32;
    n
}

/// A screen position, which may be negative on a second monitor.
fn px_signed(v: f64) -> i32 {
    // reason: the value is a screen position, far inside the range of i32
    #[allow(clippy::cast_possible_truncation)]
    let n = v as i32;
    n
}

fn scaled(window: &WebviewWindow, css: f64) -> f64 {
    css * window.scale_factor().unwrap_or(1.0)
}

/// Show the window, bring it to the front and give it focus.
pub fn show(app: &AppHandle) {
    if let Ok(window) = main_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Show the window when it is hidden, hide it when it is showing.
pub fn toggle(app: &AppHandle) {
    let Ok(window) = main_window(app) else { return };
    let showing = window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false);
    if showing {
        let _ = window.hide();
    } else {
        show(app);
    }
}

fn enter_mini(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let frame = app.state::<Frame>();
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
    }
    let saved = Saved {
        position: window.outer_position().map_err(|e| e.to_string())?,
        size: window.outer_size().map_err(|e| e.to_string())?,
        maximized,
    };
    frame.with(|i| i.saved = Some(saved));
    let area = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .map(|m| *m.work_area());
    let (w, h, gap) = (
        scaled(window, MINI_WIDTH),
        scaled(window, MINI_HEIGHT),
        scaled(window, CORNER_GAP),
    );
    window
        .set_min_size(Some(tauri::LogicalSize::new(
            MINI_MIN_WIDTH,
            MINI_MIN_HEIGHT,
        )))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(px(w), px(h)))
        .map_err(|e| e.to_string())?;
    if let Some(area) = area {
        let x = f64::from(area.position.x) + f64::from(area.size.width) - w - gap;
        let y = f64::from(area.position.y) + f64::from(area.size.height) - h - gap;
        window
            .set_position(PhysicalPosition::new(px_signed(x), px_signed(y)))
            .map_err(|e| e.to_string())?;
    }
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    show(app);
    Ok(())
}

fn leave_mini(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let frame = app.state::<Frame>();
    let saved = frame.with(|i| i.saved.take()).flatten();
    window
        .set_min_size(Some(tauri::LogicalSize::new(MIN_WIDTH, MIN_HEIGHT)))
        .map_err(|e| e.to_string())?;
    if let Some(saved) = saved {
        window.set_size(saved.size).map_err(|e| e.to_string())?;
        window
            .set_position(saved.position)
            .map_err(|e| e.to_string())?;
        if saved.maximized {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    window
        .set_always_on_top(frame.is_pinned())
        .map_err(|e| e.to_string())
}

/// Switch mode. Leaving mini restores the earlier size and place. Answers the mode now in effect.
///
/// # Errors
/// Text when the window cannot be changed.
pub fn set_mode(app: &AppHandle, mode: Mode) -> Result<Mode, String> {
    let window = main_window(app)?;
    let frame = app.state::<Frame>();
    let (was_mini, now_mini) = (frame.is_mini(), mode == Mode::Mini);
    if now_mini && !was_mini {
        enter_mini(app, &window)?;
    } else if was_mini && !now_mini {
        leave_mini(app, &window)?;
    }
    frame.with(|i| i.mode = mode);
    tray::sync(app);
    Ok(mode)
}

/// Pin or unpin (always on top). The mini window stays on top whatever the pin says.
///
/// # Errors
/// Text when the window cannot be changed.
pub fn set_pinned(app: &AppHandle, on: bool) -> Result<bool, String> {
    let frame = app.state::<Frame>();
    frame.with(|i| i.pinned = on);
    if !frame.is_mini() {
        main_window(app)?
            .set_always_on_top(on)
            .map_err(|e| e.to_string())?;
    }
    tray::sync(app);
    Ok(on)
}

/// The tray menu asked for another mode: apply it and tell the window.
pub fn mini_from_tray(app: &AppHandle) {
    let mode = if app.state::<Frame>().is_mini() {
        Mode::Full
    } else {
        Mode::Mini
    };
    if set_mode(app, mode).is_ok() {
        let _ = app.emit("window-mode", mode);
    }
}

/// The tray menu flipped the pin: apply it and tell the window.
pub fn pin_from_tray(app: &AppHandle) {
    let on = !app.state::<Frame>().is_pinned();
    if set_pinned(app, on).is_ok() {
        let _ = app.emit("pinned", on);
    }
}

/// Make the title-bar buttons follow the window's theme.
///
/// # Errors
/// Text when the theme cannot be set.
pub fn set_theme(app: &AppHandle, name: &str) -> Result<(), String> {
    let theme = if name == "light" {
        Theme::Light
    } else {
        Theme::Dark
    };
    main_window(app)?
        .set_theme(Some(theme))
        .map_err(|e| e.to_string())
}

/// In mini mode the window follows its content: set the height (CSS pixels), keeping the bottom edge.
///
/// # Errors
/// Text when the window cannot be changed.
pub fn set_mini_height(app: &AppHandle, css_height: f64) -> Result<(), String> {
    if !app.state::<Frame>().is_mini() {
        return Ok(());
    }
    let window = main_window(app)?;
    let (pos, size) = (
        window.outer_position().map_err(|e| e.to_string())?,
        window.outer_size().map_err(|e| e.to_string())?,
    );
    let gap = scaled(&window, CORNER_GAP);
    let mut height = scaled(&window, css_height.max(MINI_MIN_HEIGHT));
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        height = height.min(f64::from(monitor.work_area().size.height) - 2.0 * gap);
    }
    let bottom = pos.y + i32::try_from(size.height).unwrap_or(0);
    let new_height = px(height);
    let top = bottom - i32::try_from(new_height).unwrap_or(0);
    window
        .set_size(PhysicalSize::new(size.width, new_height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(pos.x, top))
        .map_err(|e| e.to_string())
}

/// Restart the app (the close handler must not hide the window meanwhile).
pub fn relaunch(app: &AppHandle) {
    app.state::<Frame>().with(|i| i.quitting = true);
    app.restart();
}

/// Really end the app (the close button only hides the window when close-to-tray is on).
pub fn quit(app: &AppHandle) {
    app.state::<Frame>().with(|i| i.quitting = true);
    if let Ok(window) = main_window(app) {
        // Put the normal size back first, so the saved window state is never the mini size.
        let _ = leave_mini_if_needed(app, &window);
    }
    app.exit(0);
}

fn leave_mini_if_needed(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    if app.state::<Frame>().is_mini() {
        leave_mini(app, window)?;
    }
    Ok(())
}

/// The close button: hide to the tray when asked to, otherwise let the app end.
pub fn on_window_event(window: &tauri::Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    let app = window.app_handle();
    let quitting = app.state::<Frame>().with(|i| i.quitting).unwrap_or(false);
    if !quitting && app.state::<PrefsStore>().close_to_tray() {
        api.prevent_close();
        let _ = window.hide();
    } else if let Ok(main) = main_window(app) {
        let _ = leave_mini_if_needed(app, &main);
    }
}
