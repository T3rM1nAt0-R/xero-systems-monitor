//! The commands of `docs/window-api.md`, exactly 30. Each is one call into the backend or the shell; no logic here.
//! This is the only file with command attributes.
// reason: Tauri hands commands owned arguments and expects a Result back from each
#![allow(clippy::needless_pass_by_value, clippy::unnecessary_wraps)]

use crate::frame::{self, Mode};
use crate::links;
use crate::prefs::{self, Prefs, PrefsPatch};
use crate::terminal::{self, Terminals};
use crate::updates::{self, Build, Pending};
use std::sync::Arc;
use tauri::{AppHandle, State};
use xsm_collector::{
    Action, Backend, BusyReply, Event, FinishedJob, Forecast, HistoryReply, MachineConfig,
    MachineList, Ranking, SaveOutcome, State as Readings,
};
use xsm_terminal::Size;

/// The collector the commands talk to.
pub struct BackendState(pub Arc<dyn Backend>);

type Reply<T> = Result<T, String>;

/// Run a backend call on a blocking thread, so a slow database read or an ssh wait never
/// holds a worker of the async runtime that every other command shares.
async fn blocking<T, F>(backend: &BackendState, call: F) -> Reply<T>
where
    T: Send + 'static,
    F: FnOnce(&dyn Backend) -> Reply<T> + Send + 'static,
{
    let backend = Arc::clone(&backend.0);
    tauri::async_runtime::spawn_blocking(move || call(&*backend))
        .await
        .map_err(|e| e.to_string())?
}

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
    blocking(&backend, move |b| b.get_history(&machine, range)).await
}

#[tauri::command]
pub async fn get_busy_at(
    backend: State<'_, BackendState>,
    machine: String,
    t: f64,
) -> Reply<BusyReply> {
    blocking(&backend, move |b| b.get_busy_at(&machine, t)).await
}

#[tauri::command]
pub async fn get_busiest(
    backend: State<'_, BackendState>,
    machine: String,
    range: f64,
) -> Reply<Ranking> {
    blocking(&backend, move |b| b.get_busiest(&machine, range)).await
}

#[tauri::command]
pub async fn end_task(
    backend: State<'_, BackendState>,
    machine: String,
    pid: u32,
    name: String,
) -> Reply<String> {
    blocking(&backend, move |b| b.end_task(&machine, pid, &name)).await
}

#[tauri::command]
pub async fn get_events(
    backend: State<'_, BackendState>,
    since: f64,
    n: usize,
) -> Reply<Vec<Event>> {
    blocking(&backend, move |b| b.get_events(since, n)).await
}

#[tauri::command]
pub async fn get_jobs(backend: State<'_, BackendState>, since: f64) -> Reply<Vec<FinishedJob>> {
    blocking(&backend, move |b| b.get_jobs(since)).await
}

#[tauri::command]
pub async fn get_forecast(backend: State<'_, BackendState>, machine: String) -> Reply<Forecast> {
    blocking(&backend, move |b| b.get_forecast(&machine)).await
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
    blocking(&backend, move |b| b.save_machines(machines)).await
}

#[tauri::command]
pub async fn container_action(
    backend: State<'_, BackendState>,
    machine: String,
    action: Action,
    name: String,
) -> Reply<String> {
    blocking(&backend, move |b| {
        b.container_action(&machine, action, &name)
    })
    .await
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
pub fn set_tray_status(app: AppHandle, status: String, tooltip: String) -> Reply<()> {
    crate::tray::set_status(&app, &status, &tooltip)
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
    blocking(&backend, |b| b.restart_collector()).await
}

#[tauri::command]
pub fn relaunch(app: AppHandle) -> Reply<()> {
    frame::relaunch(&app);
    Ok(())
}

#[tauri::command]
pub async fn stop_everything(app: AppHandle, backend: State<'_, BackendState>) -> Reply<()> {
    blocking(&backend, |b| b.stop_everything()).await?;
    frame::quit(&app);
    Ok(())
}

#[tauri::command]
pub fn quit(app: AppHandle) -> Reply<()> {
    frame::quit(&app);
    Ok(())
}

#[tauri::command]
pub fn open_link(url: String) -> Reply<()> {
    links::open(&url)
}

#[tauri::command]
pub fn terminal_open(
    app: AppHandle,
    backend: State<'_, BackendState>,
    terms: State<'_, Terminals>,
    id: String,
    machine: String,
    cols: u16,
    rows: u16,
) -> Reply<()> {
    let size = Size::new(cols, rows);
    terminal::open(&app, &*backend.0, &terms, &id, &machine, size)
}

#[tauri::command]
pub fn terminal_write(terms: State<'_, Terminals>, id: String, data: String) -> Reply<()> {
    terms.0.write(&id, &data)
}

#[tauri::command]
pub fn terminal_resize(terms: State<'_, Terminals>, id: String, cols: u16, rows: u16) -> Reply<()> {
    terms.0.resize(&id, Size::new(cols, rows))
}

#[tauri::command]
pub fn terminal_close(terms: State<'_, Terminals>, id: String) -> Reply<()> {
    terms.0.close(&id);
    Ok(())
}
