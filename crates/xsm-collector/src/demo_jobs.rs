//! Made-up finished jobs for the demo backend.

use crate::machines::MachineConfig;
use xsm_core::tracker::FinishedJob;

const JOB_SLOT_S: i64 = 7_200;
const JOB_LENGTH_S: i64 = 900;

/// Finished demo jobs of a runner machine: three of every four two-hour slots hold one.
pub(crate) fn jobs(machines: &[MachineConfig], since: i64, now: i64) -> Vec<FinishedJob> {
    let mut out = Vec::new();
    for m in machines.iter().filter(|m| m.runner == Some(true)) {
        let mut slot = since.max(now - 30 * 86_400) / JOB_SLOT_S;
        while slot * JOB_SLOT_S <= now {
            let (start, n) = (slot * JOB_SLOT_S, slot % 4);
            let end = start + JOB_LENGTH_S + n * 60;
            if n != 3 && end <= now && end >= since {
                let runner = crate::demo::RUNNERS[usize::from(n == 1)];
                out.push(FinishedJob {
                    machine: m.name.clone(),
                    runner: runner.to_owned(),
                    start,
                    end,
                    result: if n == 2 { "Failed" } else { "Succeeded" }.to_owned(),
                    label: format!(
                        "PR #{} · branch-{slot} · Build (example-repo)",
                        100 + slot % 900
                    ),
                });
            }
            slot += 1;
        }
    }
    out.sort_by_key(|j| j.end);
    out
}
