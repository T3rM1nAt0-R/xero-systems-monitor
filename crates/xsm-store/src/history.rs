//! The window's `History` shape, read from the sample tables and downsampled.

use crate::{Result, MAX_POINTS};
use rusqlite::{params, Connection};
use std::collections::BTreeMap;

/// `(unix seconds, value)` pairs, oldest first.
pub type Points = Vec<(f64, f64)>;

/// Every graph of one machine; a series the machine lacks is empty.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct History {
    /// CPU load, percent.
    pub cpu: Points,
    /// Memory in use, percent.
    pub ram: Points,
    /// Root disk used, percent.
    pub disk: Points,
    /// CPU temperature, degrees Celsius.
    pub temp: Points,
    /// GPU load, percent.
    pub gpu: Points,
    /// Video memory in use, percent.
    pub vram: Points,
    /// GPU temperature, degrees Celsius.
    pub gtemp: Points,
    /// Download, bytes per second.
    pub down: Points,
    /// Upload, bytes per second.
    pub up: Points,
    /// Ping, milliseconds.
    pub ping: Points,
    /// Packet loss, percent; not measured yet, so always `None`.
    pub loss: Option<f64>,
}

/// Averages of one machine's samples since `now_s - range_s`, in buckets wide enough
/// that no series has more than [`MAX_POINTS`] points. Each point sits mid-bucket.
pub(crate) fn read(conn: &Connection, machine: &str, range_s: i64, now_s: i64) -> Result<History> {
    let step = range_s / MAX_POINTS + 1;
    let mut q = conn.prepare_cached(
        "SELECT key, ts / ?2 * ?2, avg(v) FROM samples
         WHERE machine = ?1 AND ts >= ?3 AND ts <= ?4 GROUP BY key, 2 ORDER BY key, 2",
    )?;
    let rows = q.query_map(params![machine, step, now_s - range_s, now_s], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, f64>(2)?,
        ))
    })?;
    let mut by_key: BTreeMap<String, Points> = BTreeMap::new();
    for row in rows {
        let (key, bucket, v) = row?;
        // reason: unix seconds fit a f64 exactly
        #[allow(clippy::cast_precision_loss)]
        let t = bucket as f64 + step as f64 / 2.0;
        by_key.entry(key).or_default().push((t, v));
    }
    let mut take = |k: &str| by_key.remove(k).unwrap_or_default();
    Ok(History {
        cpu: take("cpu"),
        ram: take("ram"),
        disk: take("disk"),
        temp: take("temp"),
        gpu: take("gpu"),
        vram: take("vram"),
        gtemp: take("gtemp"),
        down: take("down"),
        up: take("up"),
        ping: take("ping"),
        loss: None,
    })
}
