//! The one polling thread: sources to trackers to store, every `poll_seconds`.

use crate::machines::{MachineConfig, MachineKind};
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use xsm_core::parse::parse_frame;
use xsm_core::reading::Reading;
use xsm_core::tracker::{Rules, Snapshot, Tracker};
use xsm_settings::CollectorSettings;
use xsm_sources::local::LocalSource;
use xsm_sources::ssh::SshSource;
use xsm_store::Store;

/// What the far shell runs every poll.
const PROBE: &str = include_str!("../../../probes/probe.sh");
/// Seconds in a day: maintenance (prune, backup) runs this often.
const DAY_S: i64 = 86_400;

/// Starts the far shell for a host (the system `ssh`, or a fake in tests).
pub(crate) type MakeSsh = Arc<dyn Fn(&str) -> Command + Send + Sync>;

/// Lock that survives a poisoned mutex (a panicked poll must not take the window down too).
pub(crate) fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Now, in unix seconds.
pub(crate) fn now_s() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| i64::try_from(d.as_secs()).unwrap_or(i64::MAX))
}

/// Everything one polling thread needs.
pub(crate) struct Plan {
    pub machines: Vec<MachineConfig>,
    pub settings: CollectorSettings,
    pub make_ssh: MakeSsh,
    pub store: Arc<Mutex<Store>>,
    pub snapshots: Arc<Mutex<Vec<Snapshot>>>,
    pub db_path: PathBuf,
}

/// A running polling thread. Dropping it stops the thread and every source.
pub(crate) struct Engine {
    stop: Option<Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl Engine {
    pub(crate) fn spawn(plan: Plan) -> Self {
        let (stop, stop_rx) = mpsc::channel();
        let thread = thread::spawn(move || run(&plan, &stop_rx));
        Self {
            stop: Some(stop),
            thread: Some(thread),
        }
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        drop(self.stop.take());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

enum Source {
    Local(Box<LocalSource>),
    Ssh(SshSource),
}

/// One machine: where its readings come from and what is known of it.
struct Slot {
    name: String,
    tracker: Tracker,
    source: Option<Source>,
    previous: Option<Reading>,
}

impl Slot {
    fn new(m: &MachineConfig, offline_after_misses: u32) -> Self {
        let rules = Rules {
            offline_after_misses,
            has_runners: m.runner == Some(true),
        };
        Self {
            name: m.name.clone(),
            tracker: Tracker::new(&m.name, rules),
            source: None,
            previous: None,
        }
    }

    fn open(&mut self, m: &MachineConfig, plan: &Plan) {
        self.source = match m.kind {
            MachineKind::Local => match LocalSource::new() {
                Ok(l) => Some(Source::Local(Box::new(l))),
                Err(e) => {
                    eprintln!("cannot read {}: {e}", m.name);
                    None
                }
            },
            MachineKind::Ssh => {
                let host = m.host.clone().unwrap_or_default();
                let make = Arc::clone(&plan.make_ssh);
                Some(Source::Ssh(SshSource::spawn_command(
                    move || make(&host),
                    PROBE,
                    plan.settings.poll_seconds,
                    plan.settings.ssh_reconnect_seconds,
                )))
            }
        };
    }

    /// One poll: a reading, or a miss; what happened goes to the store.
    fn step(&mut self, now: i64, store: &Store) {
        let got = match &mut self.source {
            Some(Source::Local(l)) => Some(l.poll()),
            Some(Source::Ssh(s)) => s
                .try_latest()
                .map(|text| parse_frame(&text, self.previous.as_ref())),
            None => None,
        };
        let events = match got {
            Some(r) => {
                logged(store.add_sample(&self.name, now, &r));
                self.previous = Some(r.clone());
                self.tracker.observe(r, now)
            }
            None => self.tracker.miss(now),
        };
        for e in &events {
            logged(store.add_event(e));
        }
        for j in self.tracker.take_finished() {
            logged(store.add_job(&j));
        }
    }
}

fn logged(r: xsm_store::Result<()>) {
    if let Err(e) = r {
        eprintln!("history not saved: {e}");
    }
}

fn publish(plan: &Plan, slots: &[Slot]) {
    *lock(&plan.snapshots) = slots.iter().map(|s| s.tracker.snapshot()).collect();
}

/// Once a day: roll old samples up, drop what is past retention, copy the database.
fn maintain(plan: &Plan, now: i64) {
    let store = lock(&plan.store);
    logged(store.prune(now, i64::from(plan.settings.history_days)));
    if let Err(e) = store.backup_daily(&plan.db_path, now) {
        eprintln!("backup failed: {e}");
    }
}

fn run(plan: &Plan, stop: &mpsc::Receiver<()>) {
    let misses = plan.settings.offline_after_misses;
    let mut slots: Vec<Slot> = plan.machines.iter().map(|m| Slot::new(m, misses)).collect();
    publish(plan, &slots);
    for (slot, m) in slots.iter_mut().zip(&plan.machines) {
        slot.open(m, plan);
    }
    let every = Duration::from_secs(u64::from(plan.settings.poll_seconds.max(1)));
    let mut last_maintenance: Option<i64> = None;
    loop {
        let now = now_s();
        {
            let store = lock(&plan.store);
            for slot in &mut slots {
                slot.step(now, &store);
            }
        }
        publish(plan, &slots);
        if last_maintenance.is_none_or(|t| now - t >= DAY_S) {
            last_maintenance = Some(now);
            maintain(plan, now);
        }
        if !matches!(stop.recv_timeout(every), Err(RecvTimeoutError::Timeout)) {
            return;
        }
    }
}
