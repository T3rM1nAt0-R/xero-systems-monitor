//! The busiest programs of each minute, so a click on a graph can say what was running then.

use crate::Result;
use rusqlite::{params, Connection};
use xsm_core::reading::TopProgram;

/// Seconds in a minute: one list is kept per machine per minute.
const MINUTE_S: i64 = 60;
/// Most programs kept per machine per minute.
pub const TOP_KEPT: usize = 10;
/// A stored minute further than this from the asked time is not "then", seconds.
const NEAR_S: i64 = 120;

/// The busiest programs of one stored minute.
#[derive(Debug, Clone, PartialEq)]
pub struct Busiest {
    /// Start of the stored minute, unix seconds.
    pub t: i64,
    /// Programs, busiest first.
    pub programs: Vec<TopProgram>,
}

/// Store the busiest programs of the minute holding `t`, unless that minute is already stored.
pub(crate) fn add(conn: &Connection, machine: &str, t: i64, top: &[TopProgram]) -> Result<()> {
    let minute = t.div_euclid(MINUTE_S) * MINUTE_S;
    let have = conn
        .prepare_cached("SELECT 1 FROM top WHERE machine = ?1 AND ts = ?2 LIMIT 1")?
        .exists(params![machine, minute])?;
    if have || top.is_empty() {
        return Ok(());
    }
    let mut best: Vec<&TopProgram> = top.iter().filter(|p| p.cpu_pct.is_finite()).collect();
    best.sort_by(|a, b| b.cpu_pct.total_cmp(&a.cpu_pct));
    let tx = conn.unchecked_transaction()?;
    {
        let mut put =
            tx.prepare_cached("INSERT OR IGNORE INTO top VALUES(?1, ?2, ?3, ?4, ?5, ?6)")?;
        for p in best.into_iter().take(TOP_KEPT) {
            let ram = i64::try_from(p.ram_bytes).unwrap_or(i64::MAX);
            put.execute(params![
                machine,
                minute,
                p.name,
                p.cpu_pct,
                ram,
                p.processes
            ])?;
        }
    }
    tx.commit()
}

/// The stored minute nearest to `t` (within [`NEAR_S`]), with its programs.
pub(crate) fn near(conn: &Connection, machine: &str, t: i64) -> Result<Option<Busiest>> {
    let mut q = conn.prepare_cached(
        "SELECT ts FROM (
            SELECT max(ts) AS ts FROM top WHERE machine = ?1 AND ts <= ?2
            UNION ALL SELECT min(ts) FROM top WHERE machine = ?1 AND ts >= ?2)
         WHERE ts IS NOT NULL ORDER BY abs(ts - ?2) LIMIT 1",
    )?;
    let ts: Option<i64> = q.query_row(params![machine, t], |r| r.get(0)).ok();
    let Some(ts) = ts.filter(|ts| (ts - t).abs() <= NEAR_S) else {
        return Ok(None);
    };
    let mut rows = conn.prepare_cached(
        "SELECT name, cpu, ram, n FROM top WHERE machine = ?1 AND ts = ?2 ORDER BY cpu DESC, name",
    )?;
    let programs = rows
        .query_map(params![machine, ts], |r| {
            Ok(TopProgram {
                name: r.get(0)?,
                cpu_pct: r.get(1)?,
                ram_bytes: u64::try_from(r.get::<_, i64>(2)?).unwrap_or(0),
                processes: r.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    Ok(Some(Busiest { t: ts, programs }))
}

/// Forget minutes older than `before`.
pub(crate) fn prune(conn: &Connection, before: i64) -> Result<()> {
    conn.execute("DELETE FROM top WHERE ts < ?1", [before])?;
    Ok(())
}
