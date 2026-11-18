//! The answer of `get_busy_at`: what the machine was busy with around one moment.

use serde::Serialize;
use xsm_core::reading::TopProgram;

/// Bytes in a mebibyte.
const BYTES_PER_MIB: f64 = 1_048_576.0;

/// One stored minute: `top` rows are `[name, cpu %, memory MB, process count]`, busiest first.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Busy {
    /// Start of the stored minute, unix seconds.
    pub t: f64,
    /// The programs, in the same row shape as a machine's `top`.
    pub top: Vec<(String, f64, f64, u32)>,
}

/// The answer of `get_busy_at`: the programs, or `{}` when nothing was kept for that time.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum BusyReply {
    /// Programs were kept for a minute close to the asked time.
    Found(Busy),
    /// Nothing kept (too old, machine unknown, or never sampled).
    Nothing {},
}

impl BusyReply {
    /// The one place programs become the window's `[name, cpu, MB, count]` rows.
    /// No programs at all means [`BusyReply::Nothing`].
    #[must_use]
    pub fn of(t: i64, programs: &[TopProgram]) -> Self {
        if programs.is_empty() {
            return Self::Nothing {};
        }
        // reason: unix seconds and byte counts fit a f64 closely enough for display
        #[allow(clippy::cast_precision_loss)]
        let rows = programs
            .iter()
            .map(|p| {
                (
                    p.name.clone(),
                    p.cpu_pct,
                    p.ram_bytes as f64 / BYTES_PER_MIB,
                    p.processes,
                )
            })
            .collect();
        // reason: unix seconds fit a f64 exactly
        #[allow(clippy::cast_precision_loss)]
        let t = t as f64;
        Self::Found(Busy { t, top: rows })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn programs_become_window_rows_and_none_becomes_an_empty_object() {
        let p = TopProgram {
            name: "prog".into(),
            cpu_pct: 12.5,
            ram_bytes: 2 * 1_048_576,
            processes: 3,
        };
        let v = serde_json::to_value(BusyReply::of(60, &[p])).unwrap();
        assert_eq!(
            v,
            serde_json::json!({"t": 60.0, "top": [["prog", 12.5, 2.0, 3]]})
        );
        let none = serde_json::to_value(BusyReply::of(60, &[])).unwrap();
        assert_eq!(none, serde_json::json!({}));
    }
}
