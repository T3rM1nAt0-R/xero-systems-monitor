# Changelog

All notable changes are listed here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions: [SemVer](https://semver.org/).

## [Unreleased]

- README screenshots.
- Desktop app (Tauri 2 shell with a React window): always-on-top monitor with compact and mini views, tray icon, autostart, single instance and remembered window position.
- This PC: CPU, memory, disk, network, ping, top programs, NVIDIA GPU and hardware names.
- CPU temperature from system sensors, then LibreHardwareMonitor if running, then the Windows ACPI thermal zone (read through WMI every 30 polls).
- Remote Linux machines over your own SSH config, with nothing installed on them: one shell probe, optional `nvidia-smi` and Docker readings.
- History in a local SQLite database, alerts, and in-app updates from GitHub Releases.
- Windows installers (NSIS and MSI) built by a tag-triggered release workflow that drafts a GitHub Release.
- One version number: the Cargo workspace version, checked against `app/package.json` by a wall.
- Repository set up: licence, contributing, security and design notes.
