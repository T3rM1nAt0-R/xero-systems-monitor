//! Pure: what a terminal session runs, and which ids and sizes are acceptable.

/// Longest session id accepted.
const MAX_ID_LEN: usize = 64;
/// Smallest terminal edge, in characters.
const MIN_EDGE: u16 = 1;
/// Largest terminal edge, in characters.
const MAX_EDGE: u16 = 500;
/// Seconds between ssh keep-alive messages.
const ALIVE_S: &str = "5";

/// A program to start on the pseudo-terminal.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Spec {
    /// The program to run.
    pub program: String,
    /// Its arguments.
    pub args: Vec<String>,
    /// Another program to try when `program` is not installed.
    pub fallback: Option<String>,
}

/// Rows and columns of the terminal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Size {
    /// Characters per line.
    pub cols: u16,
    /// Lines.
    pub rows: u16,
}

impl Size {
    /// A size kept inside what a terminal can sensibly be.
    #[must_use]
    pub fn new(cols: u16, rows: u16) -> Self {
        Self {
            cols: cols.clamp(MIN_EDGE, MAX_EDGE),
            rows: rows.clamp(MIN_EDGE, MAX_EDGE),
        }
    }
}

/// The shell for this PC: PowerShell 7 (`pwsh`) with Windows PowerShell as the fallback on Windows;
/// elsewhere the user's `shell` (from `$SHELL`) or `sh`.
#[must_use]
pub fn local(shell: Option<&str>, windows: bool) -> Spec {
    if windows {
        return Spec {
            program: "pwsh".to_owned(),
            args: vec!["-NoLogo".to_owned()],
            fallback: Some("powershell".to_owned()),
        };
    }
    Spec {
        program: shell
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("sh")
            .to_owned(),
        args: Vec::new(),
        fallback: Some("sh".to_owned()),
    }
}

/// `ssh -t` to a machine's configured host, using the user's own ssh client, config and keys.
/// A host that could be read as an option or that holds spaces or control characters is refused.
///
/// # Errors
/// A plain-words message when the host is empty or unsafe.
pub fn remote(host: &str) -> Result<Spec, String> {
    let host = host.trim();
    if host.is_empty()
        || host.starts_with('-')
        || host.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return Err("This machine's host is not one ssh can open.".to_owned());
    }
    let alive = format!("ServerAliveInterval={ALIVE_S}");
    Ok(Spec {
        program: "ssh".to_owned(),
        args: ["-t", "-o", alive.as_str(), "--", host]
            .map(str::to_owned)
            .to_vec(),
        fallback: None,
    })
}

/// Is this a session id the window could have made (letters, digits, `-`, `_`; not empty, not long)?
#[must_use]
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_uses_pwsh_then_powershell() {
        let s = local(None, true);
        assert_eq!(s.program, "pwsh");
        assert_eq!(s.fallback.as_deref(), Some("powershell"));
    }

    #[test]
    fn other_systems_use_the_users_shell_or_sh() {
        assert_eq!(local(Some("/bin/zsh"), false).program, "/bin/zsh");
        assert_eq!(local(Some(" "), false).program, "sh");
        assert_eq!(local(None, false).program, "sh");
    }

    #[test]
    fn remote_builds_ssh_t() {
        let s = remote(" 192.0.2.10 ").unwrap();
        assert_eq!(s.program, "ssh");
        assert_eq!(s.args.first().map(String::as_str), Some("-t"));
        assert_eq!(s.args.last().map(String::as_str), Some("192.0.2.10"));
        assert!(s.args.contains(&"--".to_owned()));
    }

    #[test]
    fn remote_refuses_unsafe_hosts() {
        for bad in ["", "  ", "-oProxyCommand=x", "a b", "a\nb"] {
            assert!(remote(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn ids_are_plain() {
        assert!(valid_id("example-server_1"));
        for bad in ["", "a b", "a/b", &"x".repeat(65)] {
            assert!(!valid_id(bad));
        }
    }

    #[test]
    fn size_is_clamped() {
        assert_eq!(Size::new(0, 9999), Size { cols: 1, rows: 500 });
        assert_eq!(Size::new(80, 24), Size { cols: 80, rows: 24 });
    }
}
