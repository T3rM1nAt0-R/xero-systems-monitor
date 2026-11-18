//! The extra history series of a reading: ones whose number depends on the machine (one per drive, and so on).
//! Each is `(key, value)`; the key says what it is: `dr:<drive>` and `dw:<drive>` are read and write bytes per second.

use crate::reading::Reading;

/// Key prefix of a drive's read speed series.
pub const READ_PREFIX: &str = "dr:";
/// Key prefix of a drive's write speed series.
pub const WRITE_PREFIX: &str = "dw:";

/// The extra series this reading adds to the history.
#[must_use]
pub fn extra_series(r: &Reading) -> Vec<(String, f64)> {
    r.disk_io
        .iter()
        .flat_map(|d| {
            [
                (format!("{READ_PREFIX}{}", d.name), d.read_bytes_per_s),
                (format!("{WRITE_PREFIX}{}", d.name), d.write_bytes_per_s),
            ]
        })
        .collect()
}
