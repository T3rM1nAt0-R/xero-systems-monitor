//! Raw readings from this PC and from Linux machines over ssh.
#![deny(missing_docs)]

pub mod local;
pub mod ssh;

use std::process::Command;

/// Windows process flag that keeps a console window from flashing up for a child process.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Stop a child process from opening a console window (Windows only; no change elsewhere).
#[cfg(windows)]
pub(crate) fn hide_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Stop a child process from opening a console window (Windows only; no change elsewhere).
#[cfg(not(windows))]
pub(crate) fn hide_window(_cmd: &mut Command) {}
