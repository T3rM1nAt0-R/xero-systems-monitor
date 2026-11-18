//! Biggest-folder scans: each runs on its own thread, can be cancelled, and is looked at by number until it is done.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use xsm_core::drives::Folder;
use xsm_sources::folders::{ScanControl, Stopped};

/// Finished scans kept for the window to pick up; older ones are forgotten.
const KEEP: usize = 8;

/// The answer of `get_big_folders`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum ScanReply {
    /// Still looking: how many files it has seen so far.
    Running {
        /// Files looked at so far.
        seen: u64,
    },
    /// Finished: the biggest folders, biggest first.
    Done {
        /// The folders.
        folders: Vec<Folder>,
    },
    /// Stopped by the person.
    Cancelled {},
    /// Could not finish, in plain words.
    Failed {
        /// What went wrong.
        error: String,
    },
}

struct Scan {
    control: ScanControl,
    done: Mutex<Option<ScanReply>>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// The scans of one backend.
#[derive(Default)]
pub(crate) struct Scans {
    next: AtomicU64,
    all: Mutex<HashMap<u64, Arc<Scan>>>,
}

impl Scans {
    /// Start `run` on its own thread; returns the number to ask about.
    pub(crate) fn start<F>(&self, run: F) -> u64
    where
        F: FnOnce(&ScanControl) -> Result<Vec<Folder>, Stopped> + Send + 'static,
    {
        let id = self.next.fetch_add(1, Ordering::Relaxed) + 1;
        let scan = Arc::new(Scan {
            control: ScanControl::default(),
            done: Mutex::new(None),
        });
        {
            let mut all = lock(&self.all);
            all.insert(id, Arc::clone(&scan));
            let mut ids: Vec<u64> = all.keys().copied().collect();
            ids.sort_unstable();
            let extra = ids.len().saturating_sub(KEEP);
            for old in ids.into_iter().take(extra) {
                all.remove(&old);
            }
        }
        thread::spawn(move || {
            let reply = match run(&scan.control) {
                Ok(folders) => ScanReply::Done { folders },
                Err(Stopped::Cancelled) => ScanReply::Cancelled {},
                Err(Stopped::TooSlow) => ScanReply::Failed {
                    error: "That took too long, so it was stopped. Try a smaller folder."
                        .to_owned(),
                },
                Err(Stopped::Failed(error)) => ScanReply::Failed { error },
            };
            *lock(&scan.done) = Some(reply);
        });
        id
    }

    /// Where scan `id` is now.
    pub(crate) fn status(&self, id: u64) -> Result<ScanReply, String> {
        let scan = lock(&self.all)
            .get(&id)
            .cloned()
            .ok_or_else(|| "That search is no longer there.".to_owned())?;
        let done = lock(&scan.done).clone();
        Ok(done.unwrap_or_else(|| ScanReply::Running {
            seen: scan.control.seen.load(Ordering::Relaxed),
        }))
    }

    /// Ask scan `id` to stop (nothing happens when it is gone or finished).
    pub(crate) fn cancel(&self, id: u64) {
        if let Some(s) = lock(&self.all).get(&id) {
            s.control.cancel.store(true, Ordering::Relaxed);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn wait(s: &Scans, id: u64) -> ScanReply {
        let end = Instant::now() + Duration::from_secs(5);
        loop {
            let r = s.status(id).unwrap();
            if !matches!(r, ScanReply::Running { .. }) || Instant::now() > end {
                return r;
            }
            thread::sleep(Duration::from_millis(10));
        }
    }

    #[test]
    fn scans_finish_fail_and_cancel() {
        let scans = Scans::default();
        let ok = scans.start(|_| {
            Ok(vec![Folder {
                path: "/a".into(),
                bytes: 5,
            }])
        });
        assert!(matches!(wait(&scans, ok), ScanReply::Done { folders } if folders.len() == 1));
        let failed = scans.start(|_| Err(Stopped::Failed("no".into())));
        assert_eq!(
            wait(&scans, failed),
            ScanReply::Failed { error: "no".into() }
        );
        let slow = scans.start(|_| Err(Stopped::TooSlow));
        assert!(matches!(wait(&scans, slow), ScanReply::Failed { .. }));
        let stopped = scans.start(|c| {
            while !c.cancel.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(5));
            }
            Err(Stopped::Cancelled)
        });
        assert!(matches!(
            scans.status(stopped),
            Ok(ScanReply::Running { .. })
        ));
        scans.cancel(stopped);
        assert_eq!(wait(&scans, stopped), ScanReply::Cancelled {});
        scans.cancel(999);
        assert!(scans.status(999).is_err());
        for _ in 0..KEEP {
            scans.start(|_| Ok(Vec::new()));
        }
        assert!(scans.status(ok).is_err(), "the oldest is forgotten");
    }
}
