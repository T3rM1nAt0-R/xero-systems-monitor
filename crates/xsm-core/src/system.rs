//! System services and updates: checking names and building the fixed commands for Linux (over `ssh`) and Windows (PowerShell).
//! Nothing here runs anything; the edge block that owns the processes does.

use serde::Deserialize;

/// Most characters a service name may have.
pub const MAX_UNIT_LEN: usize = 128;
/// Seconds an ordinary read or service action may take.
pub const QUICK_SECONDS: u64 = 20;
/// Seconds installing updates may take.
pub const UPGRADE_SECONDS: u64 = 600;
/// What an error starts with when `sudo -n` needs a password; the command to run by hand follows.
pub const PASSWORD_MARK: &str = "needs-password:";

/// What the window may read.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Query {
    /// The services of the machine.
    Services,
    /// How many updates are waiting (Linux).
    Updates,
}

/// How serious the log lines asked for must be.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    /// Errors and worse.
    Errors,
    /// Warnings, errors and worse.
    Warnings,
    /// Everything (Windows: also information).
    All,
}

/// Lines of log the Logs tab asks for.
pub const LOG_LINES: u32 = 200;

/// What the window may do. Anything else is refused when the request is read.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Act {
    /// Restart one service.
    Restart,
    /// Stop one service.
    Stop,
    /// Start one service.
    Start,
    /// Install the waiting updates (Linux).
    Upgrade,
    /// Restart the machine (Linux).
    Reboot,
}

impl Act {
    /// True for the actions that name a service.
    #[must_use]
    pub fn needs_name(self) -> bool {
        matches!(self, Act::Restart | Act::Stop | Act::Start)
    }

    /// Seconds this action may take.
    #[must_use]
    pub fn seconds(self) -> u64 {
        if self == Act::Upgrade {
            UPGRADE_SECONDS
        } else {
            QUICK_SECONDS
        }
    }

    fn verb(self) -> &'static str {
        match self {
            Act::Restart => "restart",
            Act::Stop => "stop",
            _ => "start",
        }
    }

    fn past(self) -> &'static str {
        match self {
            Act::Restart => "Restarted",
            Act::Stop => "Stopped",
            Act::Start => "Started",
            Act::Upgrade => "Installed the updates",
            Act::Reboot => "Restarting the machine",
        }
    }
}

/// True for a service name: letters, digits, `_`, `.`, `@`, `:` or `-`.
#[must_use]
pub fn valid_unit(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_UNIT_LEN
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '@' | ':' | '-'))
}

const LINUX_SERVICES: &str =
    "systemctl list-units --type=service --all --no-pager --plain --no-legend";
const LINUX_UPDATES: &str = "if command -v apt >/dev/null 2>&1; then echo \"apt $(apt list --upgradable 2>/dev/null | grep -c 'upgradable from')\"; \
elif command -v dnf >/dev/null 2>&1; then echo \"dnf $(dnf -q check-update 2>/dev/null | grep -cE '^[A-Za-z0-9_.+-]+[.][A-Za-z0-9_]+ +[0-9]')\"; else echo none; fi";
const LINUX_UPGRADE: &str = "if command -v apt-get >/dev/null 2>&1; then {sudo} apt-get -y upgrade; else {sudo} dnf -y upgrade; fi";
const WINDOWS_SERVICES: &str = "Get-Service | Select-Object Name,DisplayName,@{n='Status';e={\"$($_.Status)\"}},@{n='StartType';e={\"$($_.StartType)\"}} | ConvertTo-Json -Compress";

/// The line to run on a Linux machine for a read.
#[must_use]
pub fn linux_query(q: Query) -> String {
    match q {
        Query::Services => LINUX_SERVICES,
        Query::Updates => LINUX_UPDATES,
    }
    .to_owned()
}

/// The PowerShell script for a read, or `None` when Windows has no such read.
#[must_use]
pub fn windows_query(q: Query) -> Option<String> {
    (q == Query::Services).then(|| WINDOWS_SERVICES.to_owned())
}

/// The `journalctl` line for the recent log: the last 200 lines, at this priority, of one unit if given.
///
/// # Errors
/// Plain text when the unit is not a service name.
pub fn linux_logs(priority: Priority, unit: Option<&str>) -> Result<String, String> {
    let mut cmd = format!("journalctl -n {LOG_LINES} --no-pager -o short-iso");
    match priority {
        Priority::Errors => cmd.push_str(" -p err"),
        Priority::Warnings => cmd.push_str(" -p warning"),
        Priority::All => {}
    }
    if let Some(u) = unit.filter(|u| !u.is_empty()) {
        if !valid_unit(u) {
            return Err("That is not a service name.".to_owned());
        }
        cmd.push_str(" -u ");
        cmd.push_str(u);
    }
    Ok(cmd)
}

/// The PowerShell script for the recent System and Application events (JSON, one object per event).
#[must_use]
pub fn windows_logs(priority: Priority) -> String {
    let levels = match priority {
        Priority::Errors => "1,2",
        Priority::Warnings => "1,2,3",
        Priority::All => "1,2,3,4",
    };
    format!(
        "Get-WinEvent -FilterHashtable @{{LogName='System','Application';Level={levels}}} -MaxEvents {LOG_LINES} -ErrorAction SilentlyContinue | Select-Object @{{n='Time';e={{$_.TimeCreated.ToString('o')}}}},LogName,ProviderName,@{{n='Level';e={{\"$($_.LevelDisplayName)\"}}}},@{{n='Message';e={{($_.Message -split \"`n\")[0]}}}} | ConvertTo-Json -Compress"
    )
}

/// The line for an action on Linux. `sudo` is `"sudo -n"` to run it, or `"sudo"` for the line a person may copy.
///
/// # Errors
/// Plain text when the action needs a service name and it is not one.
pub fn linux_action(act: Act, name: &str, sudo: &str) -> Result<String, String> {
    if act.needs_name() && !valid_unit(name) {
        return Err("That is not a service name.".to_owned());
    }
    Ok(match act {
        Act::Upgrade => LINUX_UPGRADE.replace("{sudo}", sudo),
        Act::Reboot => format!("{sudo} reboot"),
        _ => format!("{sudo} systemctl {} {name}", act.verb()),
    })
}

/// The PowerShell script for an action on Windows.
///
/// # Errors
/// Plain text when the name is not a service name, or Windows has no such action here.
pub fn windows_action(act: Act, name: &str) -> Result<String, String> {
    if !act.needs_name() {
        return Err("Updates and restarts are only handled on Linux machines.".to_owned());
    }
    if !valid_unit(name) {
        return Err("That is not a service name.".to_owned());
    }
    let cmd = match act {
        Act::Restart => "Restart-Service",
        Act::Stop => "Stop-Service",
        _ => "Start-Service",
    };
    Ok(format!("{cmd} -Name '{name}' -ErrorAction Stop"))
}

/// True when `sudo -n` refused because it needs a password (or there is no tty to ask on).
#[must_use]
pub fn needs_password(stderr: &str) -> bool {
    let low = stderr.to_lowercase();
    low.contains("a password is required") || low.contains("a terminal is required")
}

/// The error for the window when sudo needs a password: the mark, then the command to copy.
#[must_use]
pub fn password_reply(act: Act, name: &str) -> String {
    let cmd = linux_action(act, name, "sudo").unwrap_or_default();
    format!("{PASSWORD_MARK}{cmd}")
}

/// The sentence for the window after an action worked.
#[must_use]
pub fn success_text(act: Act, name: &str) -> String {
    if act.needs_name() {
        format!("{} {name}.", act.past())
    } else {
        format!("{}.", act.past())
    }
}

/// A plain-words error for a failed run, from what ssh, sudo or PowerShell printed.
#[must_use]
pub fn failure_text(stderr: &str) -> String {
    let low = stderr.to_lowercase();
    if low.contains("not found") && low.contains("unit") {
        "That service does not exist on the machine.".to_owned()
    } else if low.contains("cannot open") || low.contains("access is denied") {
        "Windows refused. Start this app as administrator to change services.".to_owned()
    } else if low.contains("permission denied") {
        "ssh was refused. Check the key and the user for this machine.".to_owned()
    } else if low.contains("could not resolve") || low.contains("connection") {
        "Could not reach the machine over ssh.".to_owned()
    } else {
        let line = stderr.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
        format!("It did not finish: {}", line.trim())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names() {
        for ok in ["ssh.service", "getty@tty1.service", "a-b_c:d", "Spooler"] {
            assert!(valid_unit(ok), "{ok}");
        }
        for bad in [
            "",
            "a b",
            "a;b",
            "a$(x)",
            "a'b",
            "é",
            &"a".repeat(MAX_UNIT_LEN + 1),
        ] {
            assert!(!valid_unit(bad), "{bad:?}");
        }
    }

    #[test]
    fn reads() {
        assert!(linux_query(Query::Services).starts_with("systemctl list-units"));
        assert!(linux_query(Query::Updates).contains("apt list --upgradable"));
        assert!(windows_query(Query::Services)
            .unwrap()
            .contains("Get-Service"));
        assert!(windows_query(Query::Updates).is_none());
    }

    #[test]
    fn logs() {
        let l = |p, u| linux_logs(p, u).unwrap();
        assert_eq!(
            l(Priority::All, None),
            "journalctl -n 200 --no-pager -o short-iso"
        );
        assert!(l(Priority::Errors, Some("")).ends_with("-p err"));
        assert!(l(Priority::Warnings, Some("ssh.service")).ends_with("-p warning -u ssh.service"));
        assert!(linux_logs(Priority::All, Some("a;b")).is_err());
        assert!(windows_logs(Priority::Errors).contains("Level=1,2}"));
        assert!(windows_logs(Priority::Warnings).contains("Level=1,2,3}"));
        assert!(windows_logs(Priority::All).contains("Level=1,2,3,4}"));
        assert!(windows_logs(Priority::All).contains("-MaxEvents 200"));
    }

    #[test]
    fn linux_actions() {
        let a = |act, n, s| linux_action(act, n, s).unwrap();
        assert_eq!(
            a(Act::Restart, "ssh.service", "sudo -n"),
            "sudo -n systemctl restart ssh.service"
        );
        assert_eq!(a(Act::Stop, "x", "sudo"), "sudo systemctl stop x");
        assert_eq!(a(Act::Start, "x", "sudo"), "sudo systemctl start x");
        assert_eq!(a(Act::Reboot, "", "sudo -n"), "sudo -n reboot");
        assert!(a(Act::Upgrade, "", "sudo -n").contains("sudo -n apt-get -y upgrade"));
        assert!(linux_action(Act::Stop, "x; reboot", "sudo -n").is_err());
    }

    #[test]
    fn windows_actions() {
        let a = |act, n| windows_action(act, n).unwrap();
        assert_eq!(
            a(Act::Restart, "Spooler"),
            "Restart-Service -Name 'Spooler' -ErrorAction Stop"
        );
        assert!(a(Act::Stop, "x").starts_with("Stop-Service"));
        assert!(a(Act::Start, "x").starts_with("Start-Service"));
        assert!(windows_action(Act::Reboot, "").is_err());
        assert!(windows_action(Act::Stop, "a'b").is_err());
    }

    #[test]
    fn passwords() {
        assert!(needs_password("sudo: a password is required"));
        assert!(needs_password(
            "sudo: a terminal is required to read the password"
        ));
        assert!(!needs_password("boom"));
        assert_eq!(
            password_reply(Act::Restart, "x"),
            "needs-password:sudo systemctl restart x"
        );
        assert_eq!(password_reply(Act::Stop, "a b"), PASSWORD_MARK);
    }

    #[test]
    fn texts() {
        assert_eq!(success_text(Act::Restart, "x"), "Restarted x.");
        assert_eq!(success_text(Act::Stop, "x"), "Stopped x.");
        assert_eq!(success_text(Act::Start, "x"), "Started x.");
        assert_eq!(success_text(Act::Upgrade, ""), "Installed the updates.");
        assert_eq!(success_text(Act::Reboot, ""), "Restarting the machine.");
        let f = failure_text;
        assert!(f("Unit x.service not found.").contains("does not exist"));
        assert!(f("Cannot open x service").contains("administrator"));
        assert!(f("Permission denied (publickey)").contains("ssh was refused"));
        assert!(f("ssh: Could not resolve hostname").contains("reach"));
        assert!(f("Connection refused").contains("reach"));
        assert_eq!(f("\n boom \nmore"), "It did not finish: boom");
        assert_eq!(Act::Upgrade.seconds(), UPGRADE_SECONDS);
        assert_eq!(Act::Stop.seconds(), QUICK_SECONDS);
    }
}
