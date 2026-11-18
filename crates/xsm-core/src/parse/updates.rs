//! `REBOOT 0` or `REBOOT 1 count`: a restart is needed (and for how many packages); `UPDATES n`: updates waiting.

use crate::reading::Reading;

pub(super) fn line(tag: &str, r: &mut Reading, rest: &str) -> Option<()> {
    let mut words = rest.split_whitespace();
    let first = words.next()?;
    if tag == "UPDATES" {
        r.updates.pending = Some(first.parse().ok()?);
        return Some(());
    }
    r.updates.restart_needed = Some(match first {
        "0" => false,
        "1" => true,
        _ => return None,
    });
    r.updates.restart_packages = words.next().and_then(|n| n.parse().ok());
    Some(())
}
