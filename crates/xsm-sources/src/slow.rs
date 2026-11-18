//! Facts that are slow to read (PowerShell, `curl`, `ping`), read on their own thread so a poll never waits for them.
//! `facts()` hands back the latest answers at once. Each fact has its own period.

use crate::sensors::ping_host_ms;
use std::process::Command;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use xsm_core::drives::{parse_health, DriveHealth};
use xsm_core::netfacts::{
    clean_url, parse_adapter, parse_curl, parse_netsh, ping_host, Adapter, Internet, PingResult,
    Wifi,
};

/// Drive health is read this often (it is slow, and drives change slowly).
const HEALTH_EVERY: Duration = Duration::from_mins(10);
/// Adapters and Wi-Fi are read this often.
const ADAPTERS_EVERY: Duration = Duration::from_secs(30);
/// The internet check runs this often.
const INTERNET_EVERY: Duration = Duration::from_mins(1);
/// The machines are pinged this often.
const PINGS_EVERY: Duration = Duration::from_secs(30);
/// How often the thread looks at its clock.
const TICK: Duration = Duration::from_secs(1);
/// Seconds the internet check waits in all.
const CHECK_TIMEOUT_S: &str = "5";
/// One line per drive: name, kind (SSD or HDD), health (`ok` or `warning`), temperature, hours, wear.
const HEALTH_SCRIPT: &str = "Get-PhysicalDisk | ForEach-Object { $r = $_ | Get-StorageReliabilityCounter; \
    $h = if ($_.HealthStatus -eq 'Healthy') { 'ok' } else { 'warning' }; \
    '{0}|{1}|{2}|{3}|{4}|{5}' -f $_.FriendlyName, $_.MediaType, $h, $r.Temperature, $r.PowerOnHours, $r.Wear }";
/// One line per adapter: name, state, speed in Mbps, first IPv4 address.
const ADAPTER_SCRIPT: &str = "Get-NetAdapter | ForEach-Object { $ip = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress; \
    '{0}|{1}|{2}|{3}' -f $_.Name, $_.Status, [math]::Round($_.Speed / 1000000), $ip }";

/// What the slow thread reads: the address to check, and the machines to ping (name, host).
#[derive(Default)]
pub struct NetConfig {
    url: Mutex<String>,
    targets: Mutex<Vec<(String, String)>>,
}

impl NetConfig {
    /// Set the address of the internet check (anything but a plain `https://` address means the default).
    pub fn set_url(&self, url: &str) {
        *lock(&self.url) = clean_url(url);
    }

    /// Set the machines to ping, as (name, host); a host `ping` could take as an option is left out.
    pub fn set_targets(&self, list: &[(String, String)]) {
        *lock(&self.targets) = list
            .iter()
            .filter_map(|(n, h)| Some((n.clone(), ping_host(h)?)))
            .collect();
    }
}

/// The latest slow facts.
#[derive(Clone, Default)]
pub(crate) struct SlowFacts {
    pub drive_health: Vec<DriveHealth>,
    pub health_note: Option<String>,
    pub adapters: Vec<Adapter>,
    pub wifi: Option<Wifi>,
    pub internet: Option<Internet>,
    pub pings: Vec<PingResult>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// True (and the clock restarts) when `period` has passed since `at`, or it never ran.
fn due(at: &mut Option<Instant>, period: Duration) -> bool {
    let now = at.is_none_or(|t| t.elapsed() >= period);
    if now {
        *at = Some(Instant::now());
    }
    now
}

/// The thread that keeps [`SlowFacts`] fresh. Dropping it stops the thread.
pub(crate) struct SlowWorker {
    facts: Arc<Mutex<SlowFacts>>,
    stop: Option<Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl SlowWorker {
    pub(crate) fn start(net: Arc<NetConfig>) -> Self {
        let facts = Arc::new(Mutex::new(SlowFacts::default()));
        let (stop, stop_rx) = mpsc::channel();
        let shared = Arc::clone(&facts);
        let thread = thread::spawn(move || {
            let mut at: [Option<Instant>; 4] = [None; 4];
            loop {
                if due(&mut at[0], HEALTH_EVERY) {
                    let (list, note) = read_health();
                    let mut f = lock(&shared);
                    f.drive_health = list;
                    f.health_note = note;
                }
                if due(&mut at[1], ADAPTERS_EVERY) {
                    let (adapters, wifi) = read_adapters();
                    let mut f = lock(&shared);
                    f.adapters = adapters;
                    f.wifi = wifi;
                }
                if due(&mut at[2], INTERNET_EVERY) {
                    let url = lock(&net.url).clone();
                    let got = check_internet(&clean_url(&url));
                    lock(&shared).internet = Some(got);
                }
                if due(&mut at[3], PINGS_EVERY) {
                    let targets = lock(&net.targets).clone();
                    let pings = targets
                        .into_iter()
                        .map(|(machine, host)| PingResult {
                            ms: ping_host_ms(&host),
                            machine,
                        })
                        .collect();
                    lock(&shared).pings = pings;
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

/// Text a PowerShell command printed, or `None` off Windows or when it cannot run.
fn powershell(script: &str) -> Option<String> {
    if !cfg!(windows) {
        return None;
    }
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
    crate::hide_window(&mut cmd);
    let out = cmd.output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Drive health from Windows (`Get-PhysicalDisk` and `Get-StorageReliabilityCounter`); nothing elsewhere.
fn read_health() -> (Vec<DriveHealth>, Option<String>) {
    if !cfg!(windows) {
        return (Vec::new(), None);
    }
    let Some(text) = powershell(HEALTH_SCRIPT) else {
        return (Vec::new(), Some("missing".to_owned()));
    };
    let list: Vec<_> = text.lines().filter_map(parse_health).collect();
    let note = list.is_empty().then(|| "denied".to_owned());
    (list, note)
}

/// Adapters (`Get-NetAdapter`) and the Wi-Fi network (`netsh wlan show interfaces`); empty off Windows.
fn read_adapters() -> (Vec<Adapter>, Option<Wifi>) {
    let adapters = powershell(ADAPTER_SCRIPT)
        .map(|t| t.lines().filter_map(parse_adapter).collect())
        .unwrap_or_default();
    let wifi = cfg!(windows)
        .then(|| {
            let mut cmd = Command::new("netsh");
            cmd.args(["wlan", "show", "interfaces"]);
            crate::hide_window(&mut cmd);
            cmd.output().ok()
        })
        .flatten()
        .and_then(|o| parse_netsh(&String::from_utf8_lossy(&o.stdout)));
    (adapters, wifi)
}

/// A DNS lookup and an HTTPS HEAD request to `url`, timed by `curl` (it ships with Windows 10 and later).
fn check_internet(url: &str) -> Internet {
    let mut cmd = Command::new("curl");
    cmd.args(["-sS", "-I", "--max-time", CHECK_TIMEOUT_S, "-o"])
        .arg(if cfg!(windows) { "NUL" } else { "/dev/null" })
        .args([
            "-w",
            "%{http_code} %{time_namelookup} %{time_total}",
            "--",
            url,
        ]);
    crate::hide_window(&mut cmd);
    cmd.output()
        .map(|o| parse_curl(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default()
}
