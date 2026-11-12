//! The machine list the settings screen edits, and its checks.

use serde::{Deserialize, Serialize};

/// How a machine is reached.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MachineKind {
    /// This PC.
    Local,
    /// A Linux machine over ssh.
    Ssh,
}

/// One entry of the machine list (`MachineConfig` in `docs/window-api.md`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MachineConfig {
    /// Unique name shown in the window.
    pub name: String,
    /// Local or ssh.
    pub kind: MachineKind,
    /// Host to ssh to; needed for ssh machines.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    /// True when the machine runs CI runners.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runner: Option<bool>,
    /// The old name after a rename, so history moves over.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub was: Option<String>,
}

/// The answer of `get_machines`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MachineList {
    /// The machines.
    pub machines: Vec<MachineConfig>,
}

/// The answer of `save_machines`: `{}` when saved, `{ error }` when nothing was saved.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SaveOutcome {
    /// Why the list was refused.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl MachineConfig {
    /// Check a list: at least one machine, unique non-empty names without `|`, a host for every ssh machine.
    ///
    /// # Errors
    /// The text to show for the first problem.
    pub fn check_list(list: &[MachineConfig]) -> Result<(), String> {
        if list.is_empty() {
            return Err("Add at least one machine.".to_owned());
        }
        let mut seen: Vec<&str> = Vec::new();
        for m in list {
            let name = m.name.trim();
            if name.is_empty() || name.contains('|') {
                return Err("Every machine needs a name (no | in it).".to_owned());
            }
            if seen.contains(&name) {
                return Err(format!("Two machines are called {name}."));
            }
            let host = m.host.as_deref().unwrap_or("").trim();
            if m.kind == MachineKind::Ssh && host.is_empty() {
                return Err(format!("{name} needs a host."));
            }
            seen.push(name);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn m(name: &str, kind: MachineKind, host: Option<&str>) -> MachineConfig {
        MachineConfig {
            name: name.to_owned(),
            kind,
            host: host.map(str::to_owned),
            runner: None,
            was: None,
        }
    }

    #[test]
    fn accepts_a_good_list() {
        let list = [
            m("This PC", MachineKind::Local, None),
            m("example-server", MachineKind::Ssh, Some("192.0.2.10")),
        ];
        assert_eq!(MachineConfig::check_list(&list), Ok(()));
    }

    #[test]
    fn refuses_bad_lists() {
        let bad = |list: &[MachineConfig]| MachineConfig::check_list(list).unwrap_err();
        assert!(bad(&[]).contains("at least one"));
        assert!(bad(&[m(" ", MachineKind::Local, None)]).contains("needs a name"));
        assert!(bad(&[m("a|b", MachineKind::Local, None)]).contains("needs a name"));
        let twice = [
            m("a", MachineKind::Local, None),
            m("a", MachineKind::Local, None),
        ];
        assert!(bad(&twice).contains("Two machines"));
        assert!(bad(&[m("s", MachineKind::Ssh, Some(" "))]).contains("needs a host"));
    }

    #[test]
    fn json_matches_the_window_shape() {
        let json = r#"{"name":"s","kind":"ssh","host":"192.0.2.10","runner":true,"was":"old"}"#;
        let parsed: MachineConfig = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.kind, MachineKind::Ssh);
        assert_eq!(serde_json::to_string(&parsed).unwrap(), json);
        let empty = SaveOutcome { error: None };
        assert_eq!(serde_json::to_string(&empty).unwrap(), "{}");
    }
}
