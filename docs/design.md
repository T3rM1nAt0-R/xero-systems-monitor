# Design notes

Where the project is heading. v0.1 is a Python collector plus an Electron window. The plan below replaces both, one piece at a time, without breaking what works.

## Goals

- One small installer, no Python or Node needed on the user's PC
- Low memory and CPU use, since it runs all day
- Remote Linux machines need nothing installed: one SSH connection and a shell script
- Every feature (CPU, GPU, runners, Docker) is its own module behind one shared reading format

## Stack: Tauri 2 + Rust

The React window moves over almost unchanged and runs in the system web view (WebView2 on Windows 10/11). The collector is rewritten in Rust (`sysinfo`, `nvml-wrapper`, an SSH library). Installer size drops from about 150 MB to about 10 MB.

Alternatives considered: Wails + Go (similar, smaller community), .NET with Avalonia (reads LibreHardwareMonitor directly but means rewriting the window), Electron with a Node collector (least work, heavy), Flutter, and Qt or Slint (full UI rewrite).

## Planned layout

```
app/                 React + Vite window
  src/features/      one folder per card group: cpu, gpu, network, disk, runners, docker
core/                Rust collector
  src/sources/       local_windows, local_linux, ssh
  src/features/      parsers per feature
  src/store/         SQLite history and jobs
  src/alerts/        limits, disk-full forecast, failed jobs, flapping
probes/              shell script sent over SSH
helpers/sensors/     optional C# temperature helper
src-tauri/           window shell: tray, autostart, mini window, updater
tests/fixtures/      sample probe output (fake host names only)
```

Each Rust module replaces its Python twin and must pass the same fixture tests.

## CPU temperature

Windows only exposes CPU temperature to kernel drivers. Plan:

1. Always on: the ACPI thermal-zone reading (WMI). Shows "not available" when a machine reports nothing useful.
2. Optional, off by default: a small helper built on the LibreHardwareMonitor library (MPL-2.0, pinned, unmodified). One administrator prompt when enabled; it talks to the app over a local named pipe, with no network port.

## Releases

CI builds the installer on Windows for every tag and attaches it to a GitHub Release. Code signing through SignPath Foundation (free for open source) is planned after the first release, to avoid the SmartScreen warning.
