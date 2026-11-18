//! `ADAPTER name|state|mbps|ip`, `DISKIO name read_bps write_bps`, `SMART name|model|health|temp|hours|wear` and `SMARTNOTE why` lines.

use crate::drives::{parse_health, parse_io};
use crate::reading::Reading;

pub(super) fn line(tag: &str, r: &mut Reading, rest: &str) -> Option<()> {
    match tag {
        "DISKIO" => r.disk_io.push(parse_io(rest)?),
        "ADAPTER" => r.adapters.push(crate::netfacts::parse_adapter(rest)?),
        "SMART" => r.drive_health.push(parse_health(rest)?),
        _ => r.health_note = Some(rest.trim().to_owned()),
    }
    Some(())
}
