//! The commands of `docs/window-api.md`, exactly 19. Each is one call into the backend or the shell; no logic here.
//! This is the only file with command attributes.
// reason: Tauri hands commands owned arguments and expects a Result back from each
#![allow(clippy::needless_pass_by_value, clippy::unnecessary_wraps)]

use crate::frame::{self, Mode};
use crate::prefs::{self, Prefs, PrefsPatch};
use crate::updates::{self, Build, Pending};
use std::sync::Arc;
use tauri::{AppHandle, State};
use xsm_collector::{
    Backend, Event, FinishedJob, Forecast, HistoryReply, MachineConfig, MachineList, SaveOutcome,
    State as Readings,
};

/// The collector the commands talk to.
pub struct BackendState(pub Arc<dyn Backend>);

type Reply<T> = Result<T, String>;

#[tauri::command]
pub async fn get_state(backend: State<'_, BackendState>) -> Reply<Readings> {
    backend.0.get_state()
}

#[tauri::command]
pub async fn get_history(
    backend: State<'_, BackendState>,
    machine: String,
    range: f64,
) -> Reply<HistoryReply> {
    backend.0.get_history(&machine, range)
}

#[tauri::command]
pub async fn get_events(
    backend: State<'_, BackendState>,
    since: f64,
    n: usize,
) -> Reply<Vec<Event>> {
    backend.0.get_events(since, n)
}

#[tauri::command]
pub async fn get_jobs(backend: State<'_, BackendState>, since: f64) -> Reply<Vec<FinishedJob>> {
    backend.0.get_jobs(since)
}

#[tauri::command]
pub async fn get_forecast(backend: State<'_, BackendState>, machine: String) -> Reply<Forecast> {
    backend.0.get_forecast(&machine)
}

#[tauri::command]
pub async fn get_machines(backend: State<'_, BackendState>) -> Reply<MachineList> {
    backend.0.get_machines()
}

#[tauri::command]
pub async fn save_machines(
    backend: State<'_, BackendState>,
    machines: Vec<MachineConfig>,
) -> Reply<SaveOutcome> {
    backend.0.save_machines(machines)
}

#[tauri::command]
pub fn get_prefs(app: AppHandle) -> Reply<Prefs> {
    prefs::get(&app)
}

#[tauri::command]
pub fn set_prefs(app: AppHandle, patch: PrefsPatch) -> Reply<Prefs> {
    prefs::set(&app, &patch)
}

#[tauri::command]
pub fn set_window_mode(app: AppHandle, mode: Mode) -> Reply<Mode> {
    frame::set_mode(&app, mode)
}

#[tauri::command]
pub fn set_pinned(app: AppHandle, on: bool) -> Reply<bool> {
    frame::set_pinned(&app, on)
}

#[tauri::command]
pub fn set_theme(app: AppHandle, theme: String) -> Reply<()> {
    frame::set_theme(&app, &theme)
}

#[tauri::command]
pub fn set_mini_height(app: AppHandle, height: f64) -> Reply<()> {
    frame::set_mini_height(&app, height)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle, pending: State<'_, Pending>) -> Reply<Option<bool>> {
    Ok(updates::check(&app, &pending).await)
}

#[tauri::command]
pub async fn apply_update(app: AppHandle, pending: State<'_, Pending>) -> Reply<bool> {
    Ok(updates::apply(&app, &pending).await)
}

#[tauri::command]
pub fn get_version() -> Build {
    updates::version()
}

#[tauri::command]
pub async fn restart_collector(backend: State<'_, BackendState>) -> Reply<()> {
    backend.0.restart_collector()
}

#[tauri::command]
pub fn relaunch(app: AppHandle) -> Reply<()> {
    frame::relaunch(&app);
    Ok(())
}

#[tauri::command]
pub async fn stop_everything(app: AppHandle, backend: State<'_, BackendState>) -> Reply<()> {
    backend.0.stop_everything()?;
    frame::quit(&app);
    Ok(())
}

#[tauri::command]
pub fn quit(app: AppHandle) -> Reply<()> {
    frame::quit(&app);
    Ok(())
}
