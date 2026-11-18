//! Running as administrator: the commands behind the Terminal tab's "Admin shell…" menu, the
//! "Restart as admin" row and "Always start as admin". The Windows calls live in `xsm_sources::elevation`
//! (through `xsm_collector`); the choices (what to start, whether to relaunch) are pure and tested here.

use crate::HIDDEN_FLAG;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use xsm_collector::{is_elevated, run_as_admin, sudo_setting, RunAs};
use xsm_terminal::admin::{admin_window, Sudo};

/// Argument given to an instance started by "Restart as admin", so it never relaunches again.
pub const RELAUNCH_FLAG: &str = "--elevated-relaunch";
/// How long a relaunched instance waits for the one that started it to quit (the single-instance lock).
const OLD_QUIT_WAIT: Duration = Duration::from_secs(2);
/// What `Cancelled` is shown as to the window.
pub const CANCELLED: &str = "Cancelled";

/// Set once when "Always start as admin" was on but the person said no to Windows' question.
#[derive(Default)]
pub struct StartNotice(pub std::sync::atomic::AtomicBool);

/// Should this start relaunch itself elevated? Only when asked for, not already elevated, and not itself a relaunch.
pub fn should_relaunch(always: bool, elevated: bool, args: &[String]) -> bool {
    always && !elevated && !args.iter().any(|a| a == RELAUNCH_FLAG)
}

/// The arguments of the elevated copy: the relaunch flag, and `--hidden` when this start was hidden.
pub fn relaunch_args(args: &[String]) -> String {
    if args.iter().any(|a| a == HIDDEN_FLAG) {
        format!("{RELAUNCH_FLAG} {HIDDEN_FLAG}")
    } else {
        RELAUNCH_FLAG.to_owned()
    }
}

/// A relaunched instance gives the old one a moment to quit (before the single-instance plugin looks).
pub fn wait_if_relaunched() {
    if std::env::args().any(|a| a == RELAUNCH_FLAG) {
        std::thread::sleep(OLD_QUIT_WAIT);
    }
}

/// The full path of `name` (with `.exe`) in the folders of `PATH`.
fn on_path(name: &str) -> Option<PathBuf> {
    let file = format!("{name}.exe");
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|d| d.join(&file))
        .find(|p| p.is_file())
}

/// Is `program` installed (found on `PATH`)?
pub fn installed(program: &str) -> bool {
    on_path(program).is_some()
}

/// Does this PC's `sudo` run in the same window? (`missing`, `not_inline` or `inline`.)
pub fn sudo_state() -> Sudo {
    Sudo::from_registry(sudo_setting())
}

/// Is the app running as administrator?
pub fn elevated() -> bool {
    is_elevated()
}

fn answer(done: RunAs) -> Result<(), String> {
    match done {
        RunAs::Started => Ok(()),
        RunAs::Cancelled => Err(CANCELLED.to_owned()),
        RunAs::Failed => Err("Windows could not start it as administrator.".to_owned()),
    }
}

/// Open a separate admin window (Windows Terminal, else the shell a tab would use).
pub fn open_window() -> Result<(), String> {
    let spec = xsm_terminal::local(std::env::var("SHELL").ok().as_deref(), cfg!(windows));
    let wt = on_path("wt");
    let wt = wt.as_deref().and_then(|p| p.to_str());
    let launch = admin_window(&spec, wt, &installed);
    answer(run_as_admin(&launch.file, &launch.args))
}

/// Start a copy of this app as administrator. `Ok` means it started and the caller should quit.
pub fn relaunch_elevated() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let args: Vec<String> = std::env::args().collect();
    answer(run_as_admin(&exe.to_string_lossy(), &relaunch_args(&args)))
}

/// At start: when "Always start as admin" is on and this copy is not elevated, relaunch and say
/// whether this copy should end now. A "no" to Windows' question keeps this copy running and leaves a notice.
pub fn start_elevated_if_asked(app: &AppHandle, always: bool) -> bool {
    let args: Vec<String> = std::env::args().collect();
    if !should_relaunch(always, elevated(), &args) {
        return false;
    }
    if relaunch_elevated().is_ok() {
        return true;
    }
    app.state::<StartNotice>()
        .0
        .store(true, std::sync::atomic::Ordering::Relaxed);
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn relaunches_only_when_asked_and_not_elevated() {
        let plain = args(&["app.exe"]);
        assert!(should_relaunch(true, false, &plain));
        assert!(!should_relaunch(false, false, &plain));
        assert!(!should_relaunch(true, true, &plain));
    }

    #[test]
    fn never_relaunches_twice() {
        let again = args(&["app.exe", RELAUNCH_FLAG]);
        assert!(!should_relaunch(true, false, &again));
    }

    #[test]
    fn hidden_start_stays_hidden() {
        assert_eq!(relaunch_args(&args(&["a"])), RELAUNCH_FLAG);
        assert_eq!(
            relaunch_args(&args(&["a", HIDDEN_FLAG])),
            format!("{RELAUNCH_FLAG} {HIDDEN_FLAG}")
        );
    }

    #[test]
    fn answers_in_plain_words() {
        assert!(answer(RunAs::Started).is_ok());
        assert_eq!(answer(RunAs::Cancelled), Err(CANCELLED.to_owned()));
        assert!(answer(RunAs::Failed).is_err());
    }
}
