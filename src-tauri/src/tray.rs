//! The tray icon: click shows or hides the window; the menu has Mini, Always on top and Quit.

use crate::frame::{self, Frame};
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

const MINI: &str = "mini";
const PIN: &str = "pin";
const QUIT: &str = "quit";

/// The two check boxes, kept so the window can tick them.
#[derive(Default)]
pub struct Checks(Mutex<Option<(CheckMenuItem<tauri::Wry>, CheckMenuItem<tauri::Wry>)>>);

/// Build the tray icon and its menu.
///
/// # Errors
/// The text of whatever the system refused.
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let frame = app.state::<Frame>();
    let mini = CheckMenuItem::with_id(app, MINI, "Mini mode", true, frame.is_mini(), None::<&str>)?;
    let pin = CheckMenuItem::with_id(
        app,
        PIN,
        "Always on top",
        true,
        frame.is_pinned(),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&mini, &pin, &PredefinedMenuItem::separator(app)?, &quit],
    )?;
    if let Ok(mut slot) = app.state::<Checks>().0.lock() {
        *slot = Some((mini, pin));
    }
    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Xero Systems Monitor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MINI => frame::mini_from_tray(app),
            PIN => frame::pin_from_tray(app),
            QUIT => frame::quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                frame::toggle(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Tick the menu boxes to match the window (it may have changed from the window itself).
pub fn sync(app: &AppHandle) {
    let frame = app.state::<Frame>();
    if let Ok(slot) = app.state::<Checks>().0.lock() {
        if let Some((mini, pin)) = slot.as_ref() {
            let _ = mini.set_checked(frame.is_mini());
            let _ = pin.set_checked(frame.is_pinned());
        }
    }
}
