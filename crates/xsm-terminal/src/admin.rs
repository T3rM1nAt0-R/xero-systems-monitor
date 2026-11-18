//! Pure: running a shell as administrator. Whether Windows `sudo` can do it inside a tab, what the
//! `sudo` command line is, and what to hand to the "run as administrator" launcher for a separate window.

use crate::command::Spec;

/// The `Enabled` value of Windows 11 `sudo` that means "run in the same window" (Inline).
const SUDO_INLINE: u32 = 3;

/// Whether Windows `sudo` is there and set to run inside the same window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sudo {
    /// No `sudo` setting at all (older Windows, or not Windows).
    Missing,
    /// `sudo` exists but is off or opens a new window.
    NotInline,
    /// `sudo` runs in the same window, so a tab can be elevated.
    Inline,
}

impl Sudo {
    /// From the registry value `Enabled` (`None` when it is not there).
    #[must_use]
    pub fn from_registry(value: Option<u32>) -> Self {
        match value {
            None => Self::Missing,
            Some(SUDO_INLINE) => Self::Inline,
            Some(_) => Self::NotInline,
        }
    }

    /// The word the window gets: `missing`, `not_inline` or `inline`.
    #[must_use]
    pub fn word(self) -> &'static str {
        match self {
            Self::Missing => "missing",
            Self::NotInline => "not_inline",
            Self::Inline => "inline",
        }
    }
}

/// The program of `spec`, or its fallback when the first is not installed.
fn chosen<'a>(spec: &'a Spec, installed: &dyn Fn(&str) -> bool) -> &'a str {
    match spec.fallback.as_deref() {
        Some(other) if !installed(&spec.program) => other,
        _ => &spec.program,
    }
}

/// `spec` run through `sudo` (the shell that is installed comes after it).
#[must_use]
pub fn sudo_wrapped(spec: &Spec, installed: &dyn Fn(&str) -> bool) -> Spec {
    let mut args = vec![chosen(spec, installed).to_owned()];
    args.extend(spec.args.iter().cloned());
    Spec {
        program: "sudo".to_owned(),
        args,
        fallback: None,
    }
}

/// What to start with the "runas" verb: a file and its arguments as one string.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Launch {
    /// The program to start.
    pub file: String,
    /// Its arguments, already quoted.
    pub args: String,
}

/// A separate admin window: Windows Terminal (`wt_path`, when it was found) or else the shell `spec` would run.
#[must_use]
pub fn admin_window(
    spec: &Spec,
    wt_path: Option<&str>,
    installed: &dyn Fn(&str) -> bool,
) -> Launch {
    if let Some(wt) = wt_path {
        return Launch {
            file: wt.to_owned(),
            args: String::new(),
        };
    }
    let args: Vec<String> = spec
        .args
        .iter()
        .map(|a| {
            if a.contains(' ') {
                format!("\"{a}\"")
            } else {
                a.clone()
            }
        })
        .collect();
    Launch {
        file: chosen(spec, installed).to_owned(),
        args: args.join(" "),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::command::local;

    #[test]
    fn registry_value_maps_to_sudo_state() {
        assert_eq!(Sudo::from_registry(None), Sudo::Missing);
        assert_eq!(Sudo::from_registry(Some(3)), Sudo::Inline);
        for v in [0, 1, 2, 4] {
            assert_eq!(Sudo::from_registry(Some(v)), Sudo::NotInline);
        }
        assert_eq!(Sudo::Missing.word(), "missing");
        assert_eq!(Sudo::NotInline.word(), "not_inline");
        assert_eq!(Sudo::Inline.word(), "inline");
    }

    #[test]
    fn sudo_wraps_the_installed_shell() {
        let spec = local(None, true);
        let w = sudo_wrapped(&spec, &|p| p == "pwsh");
        assert_eq!(w.program, "sudo");
        assert_eq!(w.args, ["pwsh", "-NoLogo"]);
        let w = sudo_wrapped(&spec, &|_| false);
        assert_eq!(w.args[0], "powershell");
        assert!(w.fallback.is_none());
    }

    #[test]
    fn admin_window_prefers_windows_terminal() {
        let spec = local(None, true);
        let l = admin_window(&spec, Some("wt.exe"), &|_| true);
        assert_eq!((l.file.as_str(), l.args.as_str()), ("wt.exe", ""));
    }

    #[test]
    fn admin_window_falls_back_to_the_shell() {
        let spec = Spec {
            program: "pwsh".into(),
            args: vec!["-NoLogo".into(), "a b".into()],
            fallback: Some("powershell".into()),
        };
        let l = admin_window(&spec, None, &|p| p == "pwsh");
        assert_eq!(
            (l.file.as_str(), l.args.as_str()),
            ("pwsh", "-NoLogo \"a b\"")
        );
        assert_eq!(admin_window(&spec, None, &|_| false).file, "powershell");
    }
}
