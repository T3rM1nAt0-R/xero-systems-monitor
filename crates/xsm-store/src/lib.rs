//! History, jobs table, daily backup and retention (`SQLite`).
#![deny(missing_docs)]

mod db;
mod history;

pub use history::{History, Points};

use rusqlite::{params, Connection};
use std::path::Path;
use xsm_core::reading::Reading;
use xsm_core::tracker::{Event, FinishedJob};

/// Every error here comes from `SQLite` (or the file system under it).
pub type Result<T> = rusqlite::Result<T>;

/// Most points one series of a history answer holds, whatever the range.
pub const MAX_POINTS: i64 = 600;
/// Shortest range a history answer covers, seconds.
const MIN_RANGE_S: i64 = 1;
/// Longest range a history answer covers, seconds (400 days).
const MAX_RANGE_S: i64 = 400 * 86_400;
/// Seconds of a minute row, and of a five-minute row.
const MINUTE_S: i64 = 60;
/// Seconds of a five-minute row.
const FIVE_MIN_S: i64 = 300;
/// Raw samples are kept this long before they are averaged into minute rows.
const RAW_KEEP_S: i64 = 86_400;
/// Minute rows are kept this long before they are averaged into five-minute rows.
const MINUTE_KEEP_S: i64 = 3 * 86_400;
/// Seconds in a day.
const DAY_S: i64 = 86_400;
/// Most finished jobs one `jobs` answer holds.
const MAX_JOBS: i64 = 5000;

/// The lasting log: samples, events and finished jobs in one `SQLite` file.
#[derive(Debug)]
pub struct Store {
    conn: Connection,
}

/// The series a reading adds to the history, as `(key, value)`; a fact the reading lacks is skipped.
fn series_of(r: &Reading) -> [(&'static str, Option<f64>); 10] {
    let net = r.net.as_ref();
    let gpu = r.gpu.as_ref();
    [
        ("cpu", r.cpu.as_ref().and_then(|c| c.usage_pct)),
        ("temp", r.cpu_temp_c),
        ("ram", r.memory.as_ref().map(|m| m.used_pct)),
        ("gpu", gpu.map(|g| g.util_pct)),
        ("gtemp", gpu.map(|g| g.temp_c)),
        ("vram", gpu.map(|g| g.vram_used_pct)),
        ("down", net.and_then(|n| n.down_bytes_per_s)),
        ("up", net.and_then(|n| n.up_bytes_per_s)),
        ("ping", r.ping_ms),
        ("disk", r.disk_used_pct),
    ]
}

impl Store {
    /// Open (or create) the database file, in WAL mode, migrated to the current schema.
    ///
    /// # Errors
    /// When the file cannot be opened or was written by a newer program.
    pub fn open(path: &Path) -> Result<Self> {
        Ok(Self {
            conn: db::open(path)?,
        })
    }

    /// A database in memory, for tests and previews.
    ///
    /// # Errors
    /// When `SQLite` fails to start.
    pub fn open_in_memory() -> Result<Self> {
        Ok(Self {
            conn: db::open_in_memory()?,
        })
    }

    /// The schema version of the open database.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn schema_version(&self) -> Result<i64> {
        db::version(&self.conn)
    }

    /// Store the graphed facts of one reading taken at `t` (unix seconds).
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn add_sample(&self, machine: &str, t: i64, reading: &Reading) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut put = tx.prepare_cached("INSERT OR REPLACE INTO raw VALUES(?1, ?2, ?3, ?4)")?;
            for (key, v) in series_of(reading) {
                if let Some(v) = v.filter(|v| v.is_finite()) {
                    put.execute(params![machine, key, t, v])?;
                }
            }
        }
        tx.commit()
    }

    /// Store one event.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn add_event(&self, e: &Event) -> Result<()> {
        self.conn.execute(
            "INSERT INTO ev VALUES(?1, ?2, ?3)",
            params![e.t, e.machine, e.text],
        )?;
        Ok(())
    }

    /// Store one finished job.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn add_job(&self, j: &FinishedJob) -> Result<()> {
        self.conn.execute(
            "INSERT INTO jobs VALUES(?1, ?2, ?3, ?4, ?5, ?6)",
            params![j.machine, j.runner, j.start, j.end, j.result, j.label],
        )?;
        Ok(())
    }

    /// Move all of one machine's history, events and jobs to a new name. Rows already
    /// under the new name win a clash.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn rename_machine(&self, old: &str, new: &str) -> Result<()> {
        if old.is_empty() || new.is_empty() || old == new {
            return Ok(());
        }
        let tx = self.conn.unchecked_transaction()?;
        for table in ["raw", "minute", "five"] {
            tx.execute(
                &format!("UPDATE OR IGNORE {table} SET machine = ?2 WHERE machine = ?1"),
                params![old, new],
            )?;
            tx.execute(&format!("DELETE FROM {table} WHERE machine = ?1"), [old])?;
        }
        for table in ["ev", "jobs"] {
            tx.execute(
                &format!("UPDATE {table} SET machine = ?2 WHERE machine = ?1"),
                params![old, new],
            )?;
        }
        tx.commit()
    }

    /// The last `range_s` seconds (1 second to 400 days) of one machine, at most
    /// [`MAX_POINTS`] points per series. An unknown machine gets empty series.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn history(&self, machine: &str, range_s: i64, now_s: i64) -> Result<History> {
        history::read(
            &self.conn,
            machine,
            range_s.clamp(MIN_RANGE_S, MAX_RANGE_S),
            now_s,
        )
    }

    /// The newest `n` events at or after `since`, newest first.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn events(&self, since: i64, n: usize) -> Result<Vec<Event>> {
        let mut q = self.conn.prepare_cached(
            "SELECT ts, machine, msg FROM ev WHERE ts >= ?1 ORDER BY ts DESC, rowid DESC LIMIT ?2",
        )?;
        let rows = q.query_map(params![since, i64::try_from(n).unwrap_or(i64::MAX)], |r| {
            Ok(Event {
                t: r.get(0)?,
                machine: r.get(1)?,
                text: r.get(2)?,
            })
        })?;
        rows.collect()
    }

    /// Jobs that ended at or after `since`, oldest first (the newest few thousand).
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn jobs(&self, since: i64) -> Result<Vec<FinishedJob>> {
        let mut q = self.conn.prepare_cached(
            "SELECT machine, runner, t0, t1, res, label FROM jobs WHERE t1 >= ?1
             ORDER BY t1 DESC, rowid DESC LIMIT ?2",
        )?;
        let rows = q.query_map(params![since, MAX_JOBS], |r| {
            Ok(FinishedJob {
                machine: r.get(0)?,
                runner: r.get(1)?,
                start: r.get(2)?,
                end: r.get(3)?,
                result: r.get(4)?,
                label: r.get(5)?,
            })
        })?;
        let mut jobs = rows.collect::<Result<Vec<_>>>()?;
        jobs.reverse();
        Ok(jobs)
    }

    /// One point per UTC day (`(day start, average used percent)`) of the last `days`
    /// days of disk use, oldest first: the input of the forecast.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn disk_points(&self, machine: &str, days: i64, now_s: i64) -> Result<Vec<(i64, f64)>> {
        let mut q = self.conn.prepare_cached(
            "SELECT ts / ?3 * ?3, avg(v) FROM samples WHERE machine = ?1 AND key = 'disk' AND ts >= ?2
             GROUP BY 1 ORDER BY 1",
        )?;
        let rows = q.query_map(params![machine, now_s - days * DAY_S, DAY_S], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })?;
        rows.collect()
    }

    /// Roll old samples into coarser rows and drop what is past the retention:
    /// raw samples older than a day become minute rows, minute rows older than three
    /// days become five-minute rows, and five-minute rows, events and jobs older
    /// than `history_days` go.
    ///
    /// # Errors
    /// When `SQLite` fails.
    pub fn prune(&self, now_s: i64, history_days: i64) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        roll(&tx, "raw", "minute", MINUTE_S, now_s - RAW_KEEP_S)?;
        roll(&tx, "minute", "five", FIVE_MIN_S, now_s - MINUTE_KEEP_S)?;
        let cut = now_s - history_days * DAY_S;
        tx.execute("DELETE FROM five WHERE ts < ?1", [cut])?;
        tx.execute("DELETE FROM ev WHERE ts < ?1", [cut])?;
        tx.execute("DELETE FROM jobs WHERE t1 < ?1", [cut])?;
        tx.commit()
    }

    /// Copy the database at `db_path` to `<db_path>.bak`, at most once a day.
    /// True when a copy was made.
    ///
    /// # Errors
    /// When `SQLite` or the file system fails.
    pub fn backup_daily(&self, db_path: &Path, now_s: i64) -> Result<bool> {
        db::backup_daily(&self.conn, db_path, now_s)
    }
}

/// Average the rows of `from` older than `before` into `step`-second rows of `to`, then delete them.
/// The cut is rounded down to a whole row so no row is split between two tables.
fn roll(conn: &Connection, from: &str, to: &str, step: i64, before: i64) -> Result<()> {
    let cut = before.div_euclid(step) * step;
    conn.execute(
        &format!(
            "INSERT OR REPLACE INTO {to} SELECT machine, key, ts / ?1 * ?1, avg(v) FROM {from}
             WHERE ts < ?2 GROUP BY machine, key, 3"
        ),
        params![step, cut],
    )?;
    conn.execute(&format!("DELETE FROM {from} WHERE ts < ?1"), [cut])?;
    Ok(())
}
