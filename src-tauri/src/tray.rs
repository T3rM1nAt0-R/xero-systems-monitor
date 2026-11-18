//! The tray icon: click shows or hides the window; the menu has Mini, Always on top and Quit.

use crate::frame::{self, Frame};
use crate::tray_icon::{self, Status};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

const MINI: &str = "mini";
const PIN: &str = "pin";
const QUIT: &str = "quit";
/// The "something went red" pulse: this many big/small frames of this length, the dot growing by an eighth of the icon.
const PULSE_FRAMES: usize = 8;
const PULSE_FRAME: Duration = Duration::from_millis(350);
const PULSE_GROW_DIVISOR: usize = 8;
/// Counts status changes, so a running pulse stops when a newer status arrives.
static STATUS_GENERATION: AtomicU64 = AtomicU64::new(0);

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

/// Show how calm things are: the program icon with a green, amber or red dot, and `tooltip` as its hover text.
/// With `pulse` and a red status the dot pulses for a few seconds (the window asks for it when something has just gone red).
///
/// # Errors
/// Text when `status` is not `calm`, `look` or `bad`, or the system refuses the icon.
pub fn set_status(app: &AppHandle, status: &str, tooltip: &str, pulse: bool) -> Result<(), String> {
    let status = Status::parse(status).ok_or_else(|| format!("unknown status {status}"))?;
    let tray = app.tray_by_id("main").ok_or("no tray icon")?;
    let generation = STATUS_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    if let Some(base) = app.default_window_icon() {
        let (rgba, width, height) = (base.rgba().to_vec(), base.width(), base.height());
        let icon = tray_icon::with_dot(&rgba, width as usize, status);
        tray.set_icon(Some(Image::new_owned(icon, width, height)))
            .map_err(|e| e.to_string())?;
        if pulse && status == Status::Bad {
            let animated = tray.clone();
            std::thread::spawn(move || {
                for frame in 0..PULSE_FRAMES {
                    std::thread::sleep(PULSE_FRAME);
                    if STATUS_GENERATION.load(Ordering::SeqCst) != generation {
                        return;
                    }
                    let grow = if frame % 2 == 0 {
                        width as usize / PULSE_GROW_DIVISOR
                    } else {
                        0
                    };
                    let icon = tray_icon::with_pulse(&rgba, width as usize, status, grow);
                    let _ = animated.set_icon(Some(Image::new_owned(icon, width, height)));
                }
            });
        }
    }
    tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())
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
