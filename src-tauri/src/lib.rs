//! The desktop shell: the window's commands, tray, autostart, mini window, single instance and updater.
#![deny(missing_docs)]

mod commands;
mod frame;
mod prefs;
mod tray;
mod updates;

use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::{Builder as WindowState, StateFlags};
use xsm_collector::{Backend, DemoBackend, LiveBackend};

/// Argument Windows passes at sign-in: start in the tray, window hidden.
const HIDDEN_FLAG: &str = "--hidden";
/// Set this environment variable to `1` to show made-up data instead of polling.
const DEMO_VAR: &str = "XSM_DEMO";

/// A file with this name next to the program makes it portable.
const PORTABLE_MARKER: &str = "portable.txt";
/// In portable mode, settings and history live in this folder next to the program.
const PORTABLE_DATA: &str = "data";

/// The data folder next to the program when `portable.txt` sits beside it.
pub(crate) fn portable_dir() -> Option<std::path::PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    dir.join(PORTABLE_MARKER)
        .is_file()
        .then(|| dir.join(PORTABLE_DATA))
}

/// Where settings and history live: next to the program when portable, else the app data folder.
pub(crate) fn data_dir(app: &tauri::AppHandle) -> tauri::Result<std::path::PathBuf> {
    portable_dir().map_or_else(|| app.path().app_data_dir(), Ok)
}

/// Live data by default; made-up data when `XSM_DEMO=1`. History lives in the data folder.
fn backend_for(app: &tauri::AppHandle) -> Result<Arc<dyn Backend>, Box<dyn std::error::Error>> {
    if std::env::var(DEMO_VAR).is_ok_and(|v| v == "1") {
        return Ok(Arc::new(DemoBackend::new()));
    }
    let data_dir = data_dir(app)?;
    Ok(Arc::new(LiveBackend::start(&data_dir, None)?))
}

/// Window state to remember between runs: not whether it is visible (the tray decides that).
fn remembered() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

/// Start the app and run until it ends.
///
/// # Panics
/// When the Tauri runtime cannot start, which leaves nothing to show anyway.
pub fn run() {
    let built = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            frame::show(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![HIDDEN_FLAG]),
        ))
        .plugin(
            WindowState::default()
                .with_state_flags(remembered())
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(frame::Frame::default())
        .manage(tray::Checks::default())
        .manage(updates::Pending::default())
        .setup(|app| {
            let handle = app.handle();
            app.manage(commands::BackendState(backend_for(handle)?));
            app.manage(prefs::PrefsStore::load(handle));
            tray::build(handle)?;
            if !std::env::args().any(|a| a == HIDDEN_FLAG) {
                frame::show(handle);
            }
            Ok(())
        })
        .on_window_event(frame::on_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::get_history,
            commands::get_events,
            commands::get_jobs,
            commands::get_forecast,
            commands::get_machines,
            commands::save_machines,
            commands::get_prefs,
            commands::set_prefs,
            commands::set_window_mode,
            commands::set_pinned,
            commands::set_theme,
            commands::set_mini_height,
            commands::check_for_updates,
            commands::apply_update,
            commands::get_version,
            commands::restart_collector,
            commands::relaunch,
            commands::stop_everything,
            commands::quit,
        ])
        .build(tauri::generate_context!());
    match built {
        Ok(app) => app.run(|_, _| {}),
        Err(e) => eprintln!("cannot start: {e}"),
    }
}
