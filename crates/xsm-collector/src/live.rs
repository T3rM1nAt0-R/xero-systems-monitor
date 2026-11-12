//! The real backend: one polling thread, the store, and the machine list on disk.

use crate::config::{self, MACHINES_FILE};
use crate::history::History;
use crate::machines::{MachineConfig, MachineList, SaveOutcome};
use crate::poller::{lock, now_s, Engine, MakeSsh, Plan};
use crate::{Backend, HistoryReply, State};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use xsm_core::forecast::{forecast, Forecast};
use xsm_core::tracker::{Event, FinishedJob, Snapshot};
use xsm_settings::Settings;
use xsm_sources::ssh::ssh_command;
use xsm_store::Store;

/// The history file in the data folder.
const DB_FILE: &str = "monitor.db";
/// Days of disk use the forecast looks at.
const FORECAST_DAYS: i64 = 30;
/// Longest history range the window may ask for, seconds (400 days).
const MAX_RANGE_S: f64 = 400.0 * 86_400.0;

/// Live data: polls this PC and the ssh machines, keeps history in `<data_dir>/monitor.db`.
pub struct LiveBackend {
    machines_path: PathBuf,
    db_path: PathBuf,
    settings: Settings,
    make_ssh: MakeSsh,
    store: Arc<Mutex<Store>>,
    snapshots: Arc<Mutex<Vec<Snapshot>>>,
    machines: Mutex<Vec<MachineConfig>>,
    engine: Mutex<Option<Engine>>,
}

fn text(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl LiveBackend {
    /// Open the data folder and start polling with the system `ssh`. Settings come from
    /// `settings_dir` (`collector.json`, `limits.json`; a missing file or `None` means the built-in defaults).
    ///
    /// # Errors
    /// Text when a settings file is bad, `machines.json` is bad, or the database cannot be opened.
    pub fn start(data_dir: &Path, settings_dir: Option<&Path>) -> Result<Self, String> {
        Self::start_with_ssh(data_dir, settings_dir, ssh_command)
    }

    /// Like [`LiveBackend::start`] with the command that reaches a host passed in (tests give a fake).
    ///
    /// # Errors
    /// The same as [`LiveBackend::start`].
    pub fn start_with_ssh(
        data_dir: &Path,
        settings_dir: Option<&Path>,
        make_ssh: impl Fn(&str) -> Command + Send + Sync + 'static,
    ) -> Result<Self, String> {
        let settings = config::load_settings(settings_dir)?;
        std::fs::create_dir_all(data_dir).map_err(text)?;
        let machines_path = data_dir.join(MACHINES_FILE);
        let machines = config::load_machines(&machines_path)?;
        let db_path = data_dir.join(DB_FILE);
        let store = Store::open(&db_path).map_err(text)?;
        let live = Self {
            machines_path,
            db_path,
            settings,
            make_ssh: Arc::new(make_ssh),
            store: Arc::new(Mutex::new(store)),
            snapshots: Arc::new(Mutex::new(Vec::new())),
            machines: Mutex::new(machines),
            engine: Mutex::new(None),
        };
        live.begin();
        Ok(live)
    }

    /// (Re)start the polling thread on the current machine list.
    fn begin(&self) {
        let mut engine = lock(&self.engine);
        *engine = None;
        *engine = Some(Engine::spawn(Plan {
            machines: lock(&self.machines).clone(),
            settings: self.settings.collector.clone(),
            make_ssh: Arc::clone(&self.make_ssh),
            store: Arc::clone(&self.store),
            snapshots: Arc::clone(&self.snapshots),
            db_path: self.db_path.clone(),
        }));
    }
}

impl Backend for LiveBackend {
    fn get_state(&self) -> Result<State, String> {
        Ok(State {
            machines: lock(&self.snapshots).clone(),
        })
    }

    fn get_history(&self, machine: &str, range_s: f64) -> Result<HistoryReply, String> {
        if !lock(&self.machines).iter().any(|m| m.name == machine) {
            return Ok(HistoryReply::Unknown {});
        }
        // reason: the range is clamped to whole seconds well inside i64 (NaN becomes 0)
        #[allow(clippy::cast_possible_truncation)]
        let range = range_s.clamp(0.0, MAX_RANGE_S) as i64;
        let h = lock(&self.store)
            .history(machine, range, now_s())
            .map_err(text)?;
        Ok(HistoryReply::Known(Box::new(History::from(h))))
    }

    fn get_events(&self, since: f64, n: usize) -> Result<Vec<Event>, String> {
        // reason: unix seconds fit an i64
        #[allow(clippy::cast_possible_truncation)]
        let since = since as i64;
        lock(&self.store).events(since, n).map_err(text)
    }

    fn get_jobs(&self, since: f64) -> Result<Vec<FinishedJob>, String> {
        // reason: unix seconds fit an i64
        #[allow(clippy::cast_possible_truncation)]
        let since = since as i64;
        lock(&self.store).jobs(since).map_err(text)
    }

    fn get_forecast(&self, machine: &str) -> Result<Forecast, String> {
        let points = lock(&self.store)
            .disk_points(machine, FORECAST_DAYS, now_s())
            .map_err(text)?;
        Ok(forecast(&points))
    }

    fn get_machines(&self) -> Result<MachineList, String> {
        Ok(MachineList {
            machines: lock(&self.machines).clone(),
        })
    }

    fn save_machines(&self, mut list: Vec<MachineConfig>) -> Result<SaveOutcome, String> {
        for m in &mut list {
            m.name = m.name.trim().to_owned();
            m.host = m.host.take().map(|h| h.trim().to_owned());
        }
        if let Err(error) = MachineConfig::check_list(&list) {
            return Ok(SaveOutcome { error: Some(error) });
        }
        {
            let store = lock(&self.store);
            for m in &list {
                if let Some(old) = m.was.as_deref() {
                    store.rename_machine(old.trim(), &m.name).map_err(text)?;
                }
            }
        }
        for m in &mut list {
            m.was = None;
        }
        config::save_machines(&self.machines_path, &list)?;
        let changed = {
            let mut current = lock(&self.machines);
            let changed = *current != list;
            *current = list;
            changed
        };
        if changed {
            self.begin();
        }
        Ok(SaveOutcome { error: None })
    }

    fn restart_collector(&self) -> Result<(), String> {
        self.begin();
        Ok(())
    }

    fn stop_everything(&self) -> Result<(), String> {
        *lock(&self.engine) = None;
        Ok(())
    }
}
