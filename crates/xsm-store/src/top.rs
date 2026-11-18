//! The busiest programs of each minute, so a click on a graph can say what was running then.

use crate::Result;
use rusqlite::{params, Connection};
use xsm_core::reading::TopProgram;

/// Seconds in a minute: one list is kept per machine per minute.
const MINUTE_S: i64 = 60;
/// Programs kept per machine per minute that were busiest by CPU.
const KEEP_BY_CPU: usize = 5;
/// Programs kept per machine per minute that held the most memory (some may also be in the CPU list).
const KEEP_BY_RAM: usize = 5;
/// Most programs kept per machine per minute.
pub const TOP_KEPT: usize = KEEP_BY_CPU + KEEP_BY_RAM;
/// Most programs a ranked range answer lists.
const RANGE_ROWS: i64 = 200;
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
    let mut by_cpu: Vec<&TopProgram> = top.iter().filter(|p| p.cpu_pct.is_finite()).collect();
    by_cpu.sort_by(|a, b| b.cpu_pct.total_cmp(&a.cpu_pct));
    let mut by_ram = by_cpu.clone();
    by_ram.sort_by_key(|p| std::cmp::Reverse(p.ram_bytes));
    let mut best: Vec<&TopProgram> = by_cpu.into_iter().take(KEEP_BY_CPU).collect();
    for p in by_ram.into_iter().take(KEEP_BY_RAM) {
        if !best.iter().any(|b| b.name == p.name) {
            best.push(p);
        }
    }
    let tx = conn.unchecked_transaction()?;
    {
        let mut put =
            tx.prepare_cached("INSERT OR IGNORE INTO top VALUES(?1, ?2, ?3, ?4, ?5, ?6)")?;
        for p in best {
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

/// One program in a ranked range: how busy it was on average and how often it was among the busiest.
#[derive(Debug, Clone, PartialEq)]
pub struct Ranked {
    /// Program name (spaces shown as `_`).
    pub name: String,
    /// CPU, percent of the whole machine, averaged over every stored minute in the range.
    pub cpu_pct: f64,
    /// Memory in bytes, averaged over the minutes it was among the biggest.
    pub ram_bytes: u64,
    /// In how many stored minutes it was among the busiest or biggest.
    pub minutes: u32,
}

/// What was busy over a time range.
#[derive(Debug, Clone, PartialEq)]
pub struct RangeBusy {
    /// Stored minutes in the range (the share of the range that has data).
    pub minutes: u32,
    /// Programs, highest CPU first.
    pub programs: Vec<Ranked>,
}

/// The programs kept between `from` and `to` (unix seconds, both ends included), ranked by average CPU.
pub(crate) fn between(conn: &Connection, machine: &str, from: i64, to: i64) -> Result<RangeBusy> {
    let from = from.div_euclid(MINUTE_S) * MINUTE_S;
    let minutes: u32 = conn
        .prepare_cached(
            "SELECT COUNT(DISTINCT ts) FROM top WHERE machine = ?1 AND ts BETWEEN ?2 AND ?3",
        )?
        .query_row(params![machine, from, to], |r| r.get(0))?;
    let mut q = conn.prepare_cached(
        "SELECT name, SUM(cpu), AVG(ram), COUNT(*) FROM top
         WHERE machine = ?1 AND ts BETWEEN ?2 AND ?3
         GROUP BY name ORDER BY SUM(cpu) DESC, name LIMIT ?4",
    )?;
    let programs = q
        .query_map(params![machine, from, to, RANGE_ROWS], |r| {
            let total: f64 = r.get(1)?;
            let ram: f64 = r.get(2)?;
            Ok(Ranked {
                name: r.get(0)?,
                cpu_pct: total / f64::from(minutes.max(1)),
                // reason: an average of stored byte counts is never negative and fits u64
                #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                ram_bytes: ram as u64,
                minutes: r.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    Ok(RangeBusy { minutes, programs })
}

/// Forget minutes older than `before`.
pub(crate) fn prune(conn: &Connection, before: i64) -> Result<()> {
    conn.execute("DELETE FROM top WHERE ts < ?1", [before])?;
    Ok(())
}
