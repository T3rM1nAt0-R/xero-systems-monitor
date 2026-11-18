//! Windows administrator facts and the "run as administrator" launch. Off Windows there is nothing to
//! report: the app is never elevated, `sudo` has no setting, and a launch is refused.

/// How a "run as administrator" request ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunAs {
    /// The program was started (Windows asked its UAC question and it was answered yes).
    Started,
    /// The person said no to the UAC question.
    Cancelled,
    /// It could not be started, or this is not Windows.
    Failed,
}

/// Is this process running with administrator rights?
#[must_use]
pub fn is_elevated() -> bool {
    imp::is_elevated()
}

/// The Windows 11 `sudo` setting (`Enabled`, 0 to 3), or `None` when it is not there.
#[must_use]
pub fn sudo_setting() -> Option<u32> {
    imp::sudo_setting()
}

/// Start `file` with `args` through the UAC "runas" question.
#[must_use]
pub fn run_as_admin(file: &str, args: &str) -> RunAs {
    imp::run_as_admin(file, args)
}

#[cfg(not(windows))]
mod imp {
    use super::RunAs;

    pub(super) fn is_elevated() -> bool {
        false
    }
    pub(super) fn sudo_setting() -> Option<u32> {
        None
    }
    pub(super) fn run_as_admin(_file: &str, _args: &str) -> RunAs {
        RunAs::Failed
    }
}

#[cfg(windows)]
mod imp {
    use super::RunAs;
    use core::ffi::c_void;
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{CloseHandle, GetLastError, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    /// What `ShellExecuteW` returns at most when it failed (a real start gives a number above this).
    const SHELL_EXECUTE_FAILED_UP_TO: usize = 32;
    /// Byte sizes handed to the calls (a `TOKEN_ELEVATION` and a `DWORD` are one 32-bit value each).
    const TOKEN_ELEVATION_BYTES: u32 = 4;
    const DWORD_BYTES: u32 = 4;
    /// `ERROR_CANCELLED`: the UAC question was answered no.
    const ERROR_CANCELLED: u32 = 1223;

    pub(super) fn is_elevated() -> bool {
        let mut token = HANDLE::default();
        // reason: asks Windows for this process's own token; `token` is a valid out value and is closed below
        #[allow(unsafe_code)]
        let opened = unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &raw mut token) };
        if opened.is_err() {
            return false;
        }
        let mut info = TOKEN_ELEVATION::default();
        let mut got = 0u32;
        let size = TOKEN_ELEVATION_BYTES;
        // reason: `info` is a TOKEN_ELEVATION of exactly `size` bytes and lives for the call
        #[allow(unsafe_code)]
        let read = unsafe {
            let r = GetTokenInformation(
                token,
                TokenElevation,
                Some(core::ptr::from_mut(&mut info).cast::<c_void>()),
                size,
                &raw mut got,
            );
            let _ = CloseHandle(token);
            r
        };
        read.is_ok() && info.TokenIsElevated != 0
    }

    pub(super) fn sudo_setting() -> Option<u32> {
        let mut value = 0u32;
        let mut size = DWORD_BYTES;
        // reason: `value` is a 4-byte DWORD and `size` says so; both live for the call
        #[allow(unsafe_code)]
        let err = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                w!(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Sudo"),
                w!("Enabled"),
                RRF_RT_REG_DWORD,
                None,
                Some(core::ptr::from_mut(&mut value).cast::<c_void>()),
                Some(&raw mut size),
            )
        };
        err.is_ok().then_some(value)
    }

    pub(super) fn run_as_admin(file: &str, args: &str) -> RunAs {
        let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
        let (file, args) = (wide(file), wide(args));
        // reason: both strings are zero-ended UTF-16 that outlive the call; the other pointers are null
        #[allow(unsafe_code)]
        let (code, last) = unsafe {
            let h = ShellExecuteW(
                None,
                w!("runas"),
                PCWSTR(file.as_ptr()),
                PCWSTR(args.as_ptr()),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            );
            (h.0 as usize, GetLastError().0)
        };
        if code > SHELL_EXECUTE_FAILED_UP_TO {
            RunAs::Started
        } else if last == ERROR_CANCELLED {
            RunAs::Cancelled
        } else {
            RunAs::Failed
        }
    }
}
