//! Facts that are slow to read (drive health takes PowerShell on Windows), read on their own thread
//! so a poll never waits for them. `facts()` hands back the latest answer at once.

use std::process::Command;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use xsm_core::drives::{parse_health, DriveHealth};

/// Drive health is read this often (it is slow, and drives change slowly).
const HEALTH_EVERY: Duration = Duration::from_mins(10);
/// How often the thread looks at its clock.
const TICK: Duration = Duration::from_secs(1);
/// One line per drive: name, kind (SSD or HDD), health (`ok` or `warning`), temperature, hours, wear.
const HEALTH_SCRIPT: &str = "Get-PhysicalDisk | ForEach-Object { $r = $_ | Get-StorageReliabilityCounter; \
    $h = if ($_.HealthStatus -eq 'Healthy') { 'ok' } else { 'warning' }; \
    '{0}|{1}|{2}|{3}|{4}|{5}' -f $_.FriendlyName, $_.MediaType, $h, $r.Temperature, $r.PowerOnHours, $r.Wear }";

/// The latest slow facts.
#[derive(Clone, Default)]
pub(crate) struct SlowFacts {
    pub drive_health: Vec<DriveHealth>,
    pub health_note: Option<String>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// The thread that keeps [`SlowFacts`] fresh. Dropping it stops the thread.
pub(crate) struct SlowWorker {
    facts: Arc<Mutex<SlowFacts>>,
    stop: Option<Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl SlowWorker {
    pub(crate) fn start() -> Self {
        let facts = Arc::new(Mutex::new(SlowFacts::default()));
        let (stop, stop_rx) = mpsc::channel();
        let shared = Arc::clone(&facts);
        let thread = thread::spawn(move || {
            let mut health_at: Option<Instant> = None;
            loop {
                if health_at.is_none_or(|t| t.elapsed() >= HEALTH_EVERY) {
                    health_at = Some(Instant::now());
                    let (list, note) = read_health();
                    let mut f = lock(&shared);
                    f.drive_health = list;
                    f.health_note = note;
                }
                if !matches!(stop_rx.recv_timeout(TICK), Err(RecvTimeoutError::Timeout)) {
                    return;
                }
            }
        });
        Self {
            facts,
            stop: Some(stop),
            thread: Some(thread),
        }
    }

    pub(crate) fn facts(&self) -> SlowFacts {
        lock(&self.facts).clone()
    }
}

impl Drop for SlowWorker {
    fn drop(&mut self) {
        drop(self.stop.take());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// Drive health from Windows (`Get-PhysicalDisk` and `Get-StorageReliabilityCounter`); nothing elsewhere.
fn read_health() -> (Vec<DriveHealth>, Option<String>) {
    if !cfg!(windows) {
        return (Vec::new(), None);
    }
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", HEALTH_SCRIPT]);
    crate::hide_window(&mut cmd);
    let Ok(out) = cmd.output() else {
        return (Vec::new(), Some("missing".to_owned()));
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let list: Vec<_> = text.lines().filter_map(parse_health).collect();
    let note = list.is_empty().then(|| "denied".to_owned());
    (list, note)
}
