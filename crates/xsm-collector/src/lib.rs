//! The polling loop: sources to tracker to store. This file is also the front door of the shell:
//! the [`Backend`] trait has one method per data command of `docs/window-api.md`.
#![deny(missing_docs)]

mod config;
mod demo;
mod history;
mod live;
mod machines;
mod poller;

pub use config::alert_limits;
pub use demo::DemoBackend;
pub use history::{History, HistoryReply};
pub use live::LiveBackend;
pub use machines::{MachineConfig, MachineKind, MachineList, SaveOutcome};
// The shell may not depend on xsm-core, so the core types in the answers come through this door.
pub use xsm_core::forecast::Forecast;
pub use xsm_core::tracker::{Event, FinishedJob, Snapshot};

use serde::Serialize;

/// The answer of `get_state`: one snapshot per machine, in list order.
#[derive(Debug, Clone, Serialize)]
pub struct State {
    /// The machines.
    pub machines: Vec<Snapshot>,
}

/// What the shell asks of the collector. Failures are plain text the window shows.
pub trait Backend: Send + Sync {
    /// The latest snapshot of every machine.
    ///
    /// # Errors
    /// Text for the window when the state cannot be read.
    fn get_state(&self) -> Result<State, String>;

    /// Series for one machine over the last `range_s` seconds.
    ///
    /// # Errors
    /// Text for the window when the history cannot be read.
    fn get_history(&self, machine: &str, range_s: f64) -> Result<HistoryReply, String>;

    /// At most `n` events at or after `since` (unix seconds), newest first.
    ///
    /// # Errors
    /// Text for the window when the events cannot be read.
    fn get_events(&self, since: f64, n: usize) -> Result<Vec<Event>, String>;

    /// Finished jobs that ended at or after `since`, oldest first.
    ///
    /// # Errors
    /// Text for the window when the jobs cannot be read.
    fn get_jobs(&self, since: f64) -> Result<Vec<FinishedJob>, String>;

    /// The disk-full forecast of one machine.
    ///
    /// # Errors
    /// Text for the window when the forecast cannot be made.
    fn get_forecast(&self, machine: &str) -> Result<Forecast, String>;

    /// The machine list.
    ///
    /// # Errors
    /// Text for the window when the list cannot be read.
    fn get_machines(&self) -> Result<MachineList, String>;

    /// Check and save a new machine list; a bad list is reported in the outcome, not as an error.
    ///
    /// # Errors
    /// Text for the window when saving fails.
    fn save_machines(&self, machines: Vec<MachineConfig>) -> Result<SaveOutcome, String>;

    /// Restart polling.
    ///
    /// # Errors
    /// Text for the window when it cannot restart.
    fn restart_collector(&self) -> Result<(), String>;

    /// Stop polling for good (the shell then exits).
    ///
    /// # Errors
    /// Text for the window when it cannot stop.
    fn stop_everything(&self) -> Result<(), String>;
}
