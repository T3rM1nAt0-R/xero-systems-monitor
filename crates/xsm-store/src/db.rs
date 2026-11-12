//! Opening the database: the one home of `Connection::open`, the schema and the daily backup.

use crate::Result;
use rusqlite::backup::Backup;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};

/// Seconds in a day: a backup younger than this is left alone.
const DAY_S: i64 = 86_400;
/// How many database pages one backup step copies.
const BACKUP_PAGES: i32 = 256;
/// Pause between backup steps, so a busy writer is not starved.
const BACKUP_PAUSE: Duration = Duration::from_millis(5);

/// One entry per schema version; entry `i` moves a database from version `i` to `i + 1`.
/// Raw samples live a day, minute rows three days, five-minute rows for the retention.
const MIGRATIONS: [&str; 1] = ["
    CREATE TABLE raw(machine TEXT NOT NULL, key TEXT NOT NULL, ts INTEGER NOT NULL, v REAL NOT NULL,
        PRIMARY KEY(machine, key, ts)) WITHOUT ROWID;
    CREATE TABLE minute(machine TEXT NOT NULL, key TEXT NOT NULL, ts INTEGER NOT NULL, v REAL NOT NULL,
        PRIMARY KEY(machine, key, ts)) WITHOUT ROWID;
    CREATE TABLE five(machine TEXT NOT NULL, key TEXT NOT NULL, ts INTEGER NOT NULL, v REAL NOT NULL,
        PRIMARY KEY(machine, key, ts)) WITHOUT ROWID;
    CREATE VIEW samples AS
        SELECT machine, key, ts, v FROM raw UNION ALL
        SELECT machine, key, ts, v FROM minute UNION ALL
        SELECT machine, key, ts, v FROM five;
    CREATE TABLE ev(ts INTEGER NOT NULL, machine TEXT NOT NULL, msg TEXT NOT NULL);
    CREATE INDEX ev_ts ON ev(ts);
    CREATE TABLE jobs(machine TEXT NOT NULL, runner TEXT NOT NULL, t0 INTEGER NOT NULL,
        t1 INTEGER NOT NULL, res TEXT NOT NULL, label TEXT NOT NULL);
    CREATE INDEX jobs_t1 ON jobs(t1);
"];

/// Open (or create) the database file, in WAL mode, brought up to the current schema.
pub(crate) fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    migrate(&conn)?;
    Ok(conn)
}

/// A throw-away database that lives in memory.
pub(crate) fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    migrate(&conn)?;
    Ok(conn)
}

/// Run the migration steps the database has not seen yet. A database from a newer
/// program is refused rather than damaged.
pub(crate) fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL)")?;
    let have: i64 = conn.query_row(
        "SELECT coalesce(max(version), 0) FROM schema_version",
        [],
        |r| r.get(0),
    )?;
    let have = usize::try_from(have).unwrap_or(usize::MAX);
    if have > MIGRATIONS.len() {
        return Err(rusqlite::Error::ToSqlConversionFailure(
            "database was written by a newer version of the program".into(),
        ));
    }
    for (i, step) in MIGRATIONS.iter().enumerate().skip(have) {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(step)?;
        tx.execute("DELETE FROM schema_version", [])?;
        tx.execute(
            "INSERT INTO schema_version VALUES(?1)",
            [i64::try_from(i + 1).unwrap_or(i64::MAX)],
        )?;
        tx.commit()?;
    }
    Ok(())
}

/// The schema version stored in the database.
pub(crate) fn version(conn: &Connection) -> Result<i64> {
    conn.query_row("SELECT max(version) FROM schema_version", [], |r| r.get(0))
}

/// Where the daily copy of the database at `db` goes: `<db>.bak`.
pub(crate) fn backup_path(db: &Path) -> PathBuf {
    let mut name = db.as_os_str().to_owned();
    name.push(".bak");
    PathBuf::from(name)
}

/// Copy `conn` to `<db>.bak` with `SQLite`'s online backup unless that copy is younger
/// than a day. True when a copy was made.
pub(crate) fn backup_daily(conn: &Connection, db: &Path, now_s: i64) -> Result<bool> {
    let dest = backup_path(db);
    let age = std::fs::metadata(&dest)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .and_then(|d| i64::try_from(d.as_secs()).ok());
    if age.is_some_and(|t| now_s - t < DAY_S) {
        return Ok(false);
    }
    let mut tmp_name = dest.as_os_str().to_owned();
    tmp_name.push(".tmp");
    let tmp = PathBuf::from(tmp_name);
    {
        let mut out = Connection::open(&tmp)?;
        Backup::new(conn, &mut out)?.run_to_completion(BACKUP_PAGES, BACKUP_PAUSE, None)?;
    }
    std::fs::rename(&tmp, &dest).map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
    Ok(true)
}
