//! `DOCKON`, `DOCK name|state|status|image|ports|running_for` and `DOCKERR text` lines.

use crate::reading::{ContainerState, Reading};

/// Separator of the fields of a `DOCK` line.
const FIELD_SEPARATOR: char = '|';
/// Fields of a `DOCK` line.
const DOCK_FIELDS: usize = 6;
/// A `DOCK` line with fewer separators than this is noise; missing trailing fields stay empty.
const MIN_SEPARATORS: usize = 3;
/// Longest error text kept, in characters.
const ERROR_CHARS: usize = 200;

impl ContainerState {
    /// True for a container that fell over: restarting, dead, exited with a non-zero code,
    /// or failing its health check. A clean exit (0) or a manual stop is not bad.
    #[must_use]
    pub fn is_bad(&self) -> bool {
        let failed_exit = self
            .status
            .strip_prefix("Exited (")
            .and_then(|s| s.split_once(')'));
        matches!(self.state.as_str(), "restarting" | "dead")
            || self.status.contains("(unhealthy)")
            || (self.state == "exited" && failed_exit.is_some_and(|(code, _)| code != "0"))
    }
}

pub(super) fn line(tag: &str, r: &mut Reading, rest: &str) -> Option<()> {
    match tag {
        "DOCKON" => {
            r.containers.get_or_insert_with(Vec::new);
        }
        "DOCKERR" => r.docker_error = Some(rest.chars().take(ERROR_CHARS).collect()),
        _ => {
            if rest.matches(FIELD_SEPARATOR).count() < MIN_SEPARATORS {
                return None;
            }
            let mut fields = rest
                .splitn(DOCK_FIELDS, FIELD_SEPARATOR)
                .map(|f| f.trim().to_owned());
            let mut next = || fields.next().unwrap_or_default();
            let container = ContainerState {
                name: next(),
                state: next(),
                status: next(),
                image: next(),
                ports: next(),
                running_for: next(),
            };
            if !container.name.is_empty() {
                r.containers.get_or_insert_with(Vec::new).push(container);
            }
        }
    }
    Some(())
}
