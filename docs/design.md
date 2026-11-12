# Design notes

Why the project is built the way it is. The Python collector and Electron window of the first prototype are replaced by Rust and a Tauri window.

## Goals

- One small installer, no Python or Node needed on the user's PC
- Low memory and CPU use, since it runs all day
- Remote Linux machines need nothing installed: one SSH connection and a shell script
- Every feature (CPU, GPU, runners, Docker) is its own module behind one shared reading format

## Stack: Tauri 2 + Rust

The React window moves over almost unchanged and runs in the system web view (WebView2 on Windows 10/11). The collector is rewritten in Rust (`sysinfo`, `nvml-wrapper`, an SSH library). Installer size drops from about 150 MB to about 10 MB.

Alternatives considered: Wails + Go (similar, smaller community), .NET with Avalonia (reads LibreHardwareMonitor directly but means rewriting the window), Electron with a Node collector (least work, heavy), Flutter, and Qt or Slint (full UI rewrite).

## Layout

The plan is now real code. The folders, the crates and what each may use are in [architecture.md](architecture.md); the rules that keep them apart are in `AGENTS.md`.

## CPU temperature

Windows only exposes CPU temperature to kernel drivers. Plan:

1. Always on, last fallback after the system sensors and LibreHardwareMonitor (if running): the ACPI thermal-zone reading (WMI, read at most every 30 polls). Shows "not available" when a machine reports nothing useful.
2. Optional, off by default: a small helper built on the LibreHardwareMonitor library (MPL-2.0, pinned, unmodified). One administrator prompt when enabled; it talks to the app over a local named pipe, with no network port.

## Releases

CI builds the installers on Windows for every `v*` tag and attaches them to a draft GitHub Release (see [releasing.md](releasing.md)). Code signing through SignPath Foundation (free for open source) is planned after the first release, to avoid the SmartScreen warning.
