//! `SVCF unit`: a systemd unit in the failed state.

use crate::reading::{FailedService, Reading};

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let unit = rest.split_whitespace().next()?;
    r.failed_services.push(FailedService {
        unit: unit.to_owned(),
    });
    Some(())
}
