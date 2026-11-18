//! Drive facts: how fast each drive reads and writes, and how healthy it says it is, plus the biggest-folders list.

use serde::{Deserialize, Serialize};

/// How many folders the biggest-folders answer keeps.
pub const TOP_FOLDERS: usize = 15;
/// Bytes in a kibibyte (`du` counts in these).
const BYTES_PER_KIB: u64 = 1024;

/// Read and write speed of one drive.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DiskIo {
    /// Drive name (a letter or mount on this PC, a device on Linux).
    pub name: String,
    /// Bytes read per second since the previous frame.
    pub read_bytes_per_s: f64,
    /// Bytes written per second since the previous frame.
    pub write_bytes_per_s: f64,
}

/// What a drive says about its own health. A number it did not report is `None`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DriveHealth {
    /// Drive name.
    pub name: String,
    /// Model text (spaces shown as `_`).
    pub model: String,
    /// True when the drive reports itself healthy.
    pub ok: bool,
    /// Temperature, degrees Celsius.
    pub temp_c: Option<f64>,
    /// Hours it has been powered on.
    pub power_on_hours: Option<u64>,
    /// How worn an SSD is, percent used.
    pub wear_pct: Option<f64>,
}

/// One folder and the bytes under it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Folder {
    /// Folder path.
    pub path: String,
    /// Bytes of the files under it.
    pub bytes: u64,
}

/// `name read_bytes_per_s write_bytes_per_s` (a `DISKIO` line).
#[must_use]
pub fn parse_io(rest: &str) -> Option<DiskIo> {
    let [name, read, write] = rest.split_whitespace().collect::<Vec<_>>()[..] else {
        return None;
    };
    Some(DiskIo {
        name: name.to_owned(),
        read_bytes_per_s: read.parse().ok()?,
        write_bytes_per_s: write.parse().ok()?,
    })
}

/// `name|model|health|temp|hours|wear` where health is `ok` (anything else is a warning) and an empty field is unknown.
#[must_use]
pub fn parse_health(rest: &str) -> Option<DriveHealth> {
    let f: Vec<&str> = rest.trim().split('|').map(str::trim).collect();
    let [name, model, health, temp, hours, wear] = f[..] else {
        return None;
    };
    (!name.is_empty()).then(|| DriveHealth {
        name: name.to_owned(),
        model: model.replace(' ', "_"),
        ok: health.eq_ignore_ascii_case("ok"),
        temp_c: temp.parse().ok(),
        power_on_hours: hours.parse().ok(),
        wear_pct: wear.parse().ok(),
    })
}

/// The folders of `du -d 2` output (`KiB<TAB>path` per line), biggest first, at most [`TOP_FOLDERS`].
/// `root` itself is left out, so the answer lists what is inside it.
#[must_use]
pub fn parse_du(text: &str, root: &str) -> Vec<Folder> {
    let all = text.lines().filter_map(|l| {
        let (kib, path) = l.split_once('\t')?;
        Some(Folder {
            path: path.trim_end().to_owned(),
            bytes: kib
                .trim()
                .parse::<u64>()
                .ok()?
                .saturating_mul(BYTES_PER_KIB),
        })
    });
    biggest(all.filter(|f| f.path != root).collect())
}

/// The biggest folders of a list, biggest first, at most [`TOP_FOLDERS`].
#[must_use]
pub fn biggest(mut all: Vec<Folder>) -> Vec<Folder> {
    all.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.path.cmp(&b.path)));
    all.truncate(TOP_FOLDERS);
    all
}

/// Whether a path is fine to hand to `du` or a directory walk: not empty, no line breaks, not an option.
#[must_use]
pub fn path_ok(path: &str) -> bool {
    !path.trim().is_empty() && !path.starts_with('-') && !path.contains(['\n', '\r', '\0'])
}
