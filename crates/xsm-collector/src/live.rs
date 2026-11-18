//! The real backend: one polling thread, the store, and the machine list on disk.

use crate::config::{self, MACHINES_FILE};
use crate::history::History;
use crate::machines::{MachineConfig, MachineList, SaveOutcome};
use crate::poller::{lock, now_s, Engine, MakeSsh, Plan};
use crate::scan::{ScanReply, Scans};
use crate::{Act, Action, Backend, BusyReply, HistoryReply, MachineKind, Query, State};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use xsm_core::drives::path_ok;
use xsm_core::forecast::{forecast, Forecast};
use xsm_core::tracker::{Event, FinishedJob, Snapshot};
use xsm_settings::Settings;
use xsm_sources::container::run_container_action;
use xsm_sources::folders::{scan_local, scan_ssh};
use xsm_sources::slow::NetConfig;
use xsm_sources::ssh::ssh_command;
use xsm_sources::system::{run_action, run_query, Target};
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
    /// A second connection (WAL) for the window's reads, so a long history read never holds up the poller's writes.
    reader: Mutex<Store>,
    snapshots: Arc<Mutex<Vec<Snapshot>>>,
    machines: Mutex<Vec<MachineConfig>>,
    engine: Mutex<Option<Engine>>,
    scans: Scans,
    net: Arc<NetConfig>,
}

fn text(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl LiveBackend {
    /// Run `f` against the named machine: over ssh for a remote one, in PowerShell for this PC.
    fn with_target<T>(
        &self,
        machine: &str,
        f: impl FnOnce(Target<'_>) -> Result<T, String>,
    ) -> Result<T, String> {
        let found = lock(&self.machines)
            .iter()
            .find(|m| m.name == machine)
            .map(|m| (m.kind, m.host.clone()));
        match found {
            Some((MachineKind::Ssh, Some(host))) => f(Target::Ssh(&host)),
            Some((MachineKind::Local, _)) => f(Target::Pc),
            _ => Err("That machine is not in the list.".to_owned()),
        }
    }

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
        let reader = Store::open(&db_path).map_err(text)?;
        let live = Self {
            machines_path,
            db_path,
            settings,
            make_ssh: Arc::new(make_ssh),
            store: Arc::new(Mutex::new(store)),
            reader: Mutex::new(reader),
            snapshots: Arc::new(Mutex::new(Vec::new())),
            machines: Mutex::new(machines),
            engine: Mutex::new(None),
            scans: Scans::default(),
            net: Arc::default(),
        };
        live.begin();
        Ok(live)
    }

    /// (Re)start the polling thread on the current machine list.
    fn begin(&self) {
        let mut engine = lock(&self.engine);
        *engine = None;
        *engine = Some(Engine::spawn(Plan {
            machines: MachineConfig::polled(&lock(&self.machines)),
            settings: self.settings.collector.clone(),
            make_ssh: Arc::clone(&self.make_ssh),
            store: Arc::clone(&self.store),
            snapshots: Arc::clone(&self.snapshots),
            db_path: self.db_path.clone(),
            net: Arc::clone(&self.net),
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
        let h = lock(&self.reader)
            .history(machine, range, now_s())
            .map_err(text)?;
        Ok(HistoryReply::Known(Box::new(History::from(h))))
    }

    fn get_busy_at(&self, machine: &str, t: f64) -> Result<BusyReply, String> {
        // reason: unix seconds fit an i64 (NaN becomes 0)
        #[allow(clippy::cast_possible_truncation)]
        let t = t as i64;
        let found = lock(&self.reader).busiest_at(machine, t).map_err(text)?;
        Ok(found.map_or(BusyReply::Nothing {}, |b| BusyReply::of(b.t, &b.programs)))
    }

    fn get_events(&self, since: f64, n: usize) -> Result<Vec<Event>, String> {
        // reason: unix seconds fit an i64
        #[allow(clippy::cast_possible_truncation)]
        let since = since as i64;
        lock(&self.reader).events(since, n).map_err(text)
    }

    fn get_jobs(&self, since: f64) -> Result<Vec<FinishedJob>, String> {
        // reason: unix seconds fit an i64
        #[allow(clippy::cast_possible_truncation)]
        let since = since as i64;
        lock(&self.reader).jobs(since).map_err(text)
    }

    fn get_forecast(&self, machine: &str) -> Result<Forecast, String> {
        let points = lock(&self.reader)
            .disk_points(machine, FORECAST_DAYS, now_s())
            .map_err(text)?;
        Ok(forecast(&points))
    }

    fn container_action(
        &self,
        machine: &str,
        action: Action,
        name: &str,
    ) -> Result<String, String> {
        let host = lock(&self.machines)
            .iter()
            .find(|m| m.name == machine && m.kind == MachineKind::Ssh)
            .and_then(|m| m.host.clone())
            .ok_or_else(|| "Container actions work only on remote machines.".to_owned())?;
        run_container_action(&host, action, name)
    }

    fn system_query(&self, machine: &str, query: Query) -> Result<String, String> {
        self.with_target(machine, |t| run_query(t, query))
    }

    fn system_action(&self, machine: &str, act: Act, name: &str) -> Result<String, String> {
        self.with_target(machine, |t| run_action(t, act, name))
    }

    fn find_big_folders(&self, machine: &str, path: &str) -> Result<u64, String> {
        let found = lock(&self.machines)
            .iter()
            .find(|m| m.name == machine)
            .cloned();
        let m = found.ok_or_else(|| "That machine is not in the list.".to_owned())?;
        if !path_ok(path) {
            return Err("Type a folder path, like / or D:\\.".to_owned());
        }
        let path = path.trim().to_owned();
        Ok(match (m.kind, m.host) {
            (MachineKind::Ssh, Some(host)) => self.scans.start(move |c| scan_ssh(&host, &path, c)),
            _ => self.scans.start(move |c| scan_local(&path, c)),
        })
    }

    fn get_big_folders(&self, job: u64) -> Result<ScanReply, String> {
        self.scans.status(job)
    }

    fn cancel_big_folders(&self, job: u64) -> Result<(), String> {
        self.scans.cancel(job);
        Ok(())
    }

    fn set_internet_host(&self, url: &str) -> Result<(), String> {
        self.net.set_url(url);
        Ok(())
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
