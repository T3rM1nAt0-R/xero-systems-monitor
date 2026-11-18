//! The extra history series of a reading: ones whose number depends on the machine (one per drive, and so on).
//! Each is `(key, value)`; the key says what it is: `dr:<drive>` and `dw:<drive>` are read and write bytes per second.

use crate::reading::Reading;

/// Key prefix of a drive's read speed series.
pub const READ_PREFIX: &str = "dr:";
/// Key prefix of a drive's write speed series.
pub const WRITE_PREFIX: &str = "dw:";

/// Key of the internet check: 1 when it answered, 0 when not.
pub const INTERNET_UP: &str = "inet";
/// Key of the internet check's time, milliseconds.
pub const INTERNET_MS: &str = "inet_ms";
/// Key prefix of the ping time to one machine.
pub const PING_PREFIX: &str = "pm:";

/// The extra series this reading adds to the history.
#[must_use]
pub fn extra_series(r: &Reading) -> Vec<(String, f64)> {
    let mut out: Vec<(String, f64)> = Vec::new();
    if let Some(i) = &r.internet {
        out.push((INTERNET_UP.to_owned(), f64::from(u8::from(i.up))));
        out.extend(i.latency_ms.map(|ms| (INTERNET_MS.to_owned(), ms)));
    }
    out.extend(
        r.pings
            .iter()
            .filter_map(|p| Some((format!("{PING_PREFIX}{}", p.machine), p.ms?))),
    );
    out.extend(drive_series(r));
    out
}

fn drive_series(r: &Reading) -> Vec<(String, f64)> {
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
