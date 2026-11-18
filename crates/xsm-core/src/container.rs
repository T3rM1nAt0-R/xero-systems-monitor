//! Container actions: checking the container name and building the one fixed `docker` command.
//! Nothing here runs anything; the edge block that owns `ssh` does.

use serde::Deserialize;

/// Most characters a container name may have (docker allows far fewer in practice).
pub const MAX_NAME_LEN: usize = 128;
/// Lines of log the Logs action asks for.
pub const LOG_LINES: u32 = 50;

/// What the window may ask for. Anything else is refused when the request is read.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    /// `docker restart`.
    Restart,
    /// `docker stop`.
    Stop,
    /// `docker start`.
    Start,
    /// `docker logs --tail 50`.
    Logs,
}

/// True for a docker container name: a letter or digit first, then letters, digits, `_`, `.` or `-`.
#[must_use]
pub fn valid_name(name: &str) -> bool {
    let mut chars = name.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphanumeric())
        && name.len() <= MAX_NAME_LEN
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

/// The words after `ssh <host>`: `docker <action> <name>`, one argument each.
/// The name passed [`valid_name`], so the far shell cannot read anything special in it.
///
/// # Errors
/// Plain text when the name is not a docker container name.
pub fn docker_args(action: Action, name: &str) -> Result<Vec<String>, String> {
    if !valid_name(name) {
        return Err("That is not a container name docker would accept.".to_owned());
    }
    let mut args = vec!["docker".to_owned()];
    match action {
        Action::Restart => args.push("restart".to_owned()),
        Action::Stop => args.push("stop".to_owned()),
        Action::Start => args.push("start".to_owned()),
        Action::Logs => {
            args.extend(["logs", "--tail"].map(str::to_owned));
            args.push(LOG_LINES.to_string());
        }
    }
    args.push(name.to_owned());
    Ok(args)
}

fn past(action: Action) -> &'static str {
    match action {
        Action::Restart => "Restarted",
        Action::Stop => "Stopped",
        Action::Start => "Started",
        Action::Logs => "Read the logs of",
    }
}

/// The text for the window after docker succeeded: the log lines for Logs, a short sentence otherwise.
/// Docker writes a container's error output to stderr, so Logs shows both.
#[must_use]
pub fn success_text(action: Action, name: &str, stdout: &str, stderr: &str) -> String {
    if action == Action::Logs {
        format!("{stdout}{stderr}")
    } else {
        format!("{} {name}.", past(action))
    }
}

/// A plain-words error for a failed docker run, from what docker or ssh printed.
#[must_use]
pub fn failure_text(stderr: &str) -> String {
    let low = stderr.to_lowercase();
    if low.contains("permission denied") && low.contains("docker") {
        "Docker refused: the ssh user needs to be in the docker group on that machine.".to_owned()
    } else if low.contains("no such container") {
        "That container no longer exists on the machine.".to_owned()
    } else if low.contains("permission denied") {
        "ssh was refused. Check the key and the user for this machine.".to_owned()
    } else if low.contains("could not resolve") || low.contains("connection") {
        "Could not reach the machine over ssh.".to_owned()
    } else if low.contains("command not found") {
        "Docker is not installed on that machine.".to_owned()
    } else {
        let line = stderr.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
        format!("Docker did not finish: {}", line.trim())
    }
}

/// The error when the run took too long.
#[must_use]
pub fn timeout_text() -> String {
    "The machine did not answer in time. Try again in a moment.".to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names() {
        for ok in [
            "a",
            "web-1",
            "my_app.v2",
            "9lives",
            &"a".repeat(MAX_NAME_LEN),
        ] {
            assert!(valid_name(ok), "{ok}");
        }
        for bad in [
            "",
            "-x",
            ".x",
            "_x",
            "a b",
            "a;b",
            "a$(x)",
            "a\nb",
            "é",
            "a/b",
            &"a".repeat(MAX_NAME_LEN + 1),
        ] {
            assert!(!valid_name(bad), "{bad:?}");
        }
    }

    #[test]
    fn args() {
        let a = |act, n| docker_args(act, n).unwrap();
        assert_eq!(a(Action::Restart, "web"), ["docker", "restart", "web"]);
        assert_eq!(a(Action::Stop, "web"), ["docker", "stop", "web"]);
        assert_eq!(a(Action::Start, "web"), ["docker", "start", "web"]);
        assert_eq!(
            a(Action::Logs, "web"),
            ["docker", "logs", "--tail", "50", "web"]
        );
        assert!(docker_args(Action::Stop, "x; rm -rf /").is_err());
    }

    #[test]
    fn action_from_text() {
        let p = |s| serde_json::from_str::<Action>(s);
        assert_eq!(p("\"logs\"").unwrap(), Action::Logs);
        assert_eq!(p("\"restart\"").unwrap(), Action::Restart);
        assert_eq!(p("\"stop\"").unwrap(), Action::Stop);
        assert_eq!(p("\"start\"").unwrap(), Action::Start);
        assert!(p("\"rm\"").is_err());
    }

    #[test]
    fn success() {
        assert_eq!(success_text(Action::Logs, "w", "a\n", "b\n"), "a\nb\n");
        assert_eq!(success_text(Action::Restart, "w", "w", ""), "Restarted w.");
        assert_eq!(success_text(Action::Stop, "w", "", ""), "Stopped w.");
        assert_eq!(success_text(Action::Start, "w", "", ""), "Started w.");
    }

    #[test]
    fn failures() {
        let f = failure_text;
        assert!(
            f("permission denied while trying to connect to the docker daemon")
                .contains("docker group")
        );
        assert!(f("Error: No such container: x").contains("no longer exists"));
        assert!(f("user@192.0.2.10: Permission denied (publickey).").contains("ssh was refused"));
        assert!(f("ssh: Could not resolve hostname example-server").contains("reach"));
        assert!(f("ssh: connect to host: Connection refused").contains("reach"));
        assert!(f("sh: 1: docker: command not found").contains("not installed"));
        assert_eq!(f("\n boom \nmore"), "Docker did not finish: boom");
        assert_eq!(f(""), "Docker did not finish: ");
        assert!(timeout_text().contains("in time"));
    }
}
