# Changelog

All notable changes are listed here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions: [SemVer](https://semver.org/).

## [Unreleased]

- Uptime and restart status: each machine card shows how long it has been on and when it last restarted, and "Restart needed for updates" in amber when the system says so (Debian and Ubuntu over ssh, and Windows on This PC). Other systems show no restart line.

## [0.1.2] - 2026-11-17

- Fixed: the installed app now shows Updates (Check for updates, Update by itself) in the More menu; it was hidden in installed builds and shown only in development runs. The portable copy still hides it.

## [0.1.1] - 2026-11-17

- Runners on this PC: Windows self-hosted runners (`Runner.Listener` / `Runner.Worker`) now show on This PC's card like on Linux machines, with the job name from the runner's worker log, its CPU and memory, and the result when it ends.

## [0.1.0] - 2026-11-12

- README screenshots.
- Desktop app (Tauri 2 shell with a React window): always-on-top monitor with compact and mini views, tray icon, autostart, single instance and remembered window position.
- This PC: CPU, memory, disk, network, ping, top programs, NVIDIA GPU and hardware names.
- CPU temperature from system sensors, then LibreHardwareMonitor if running, then the Windows ACPI thermal zone (read through WMI every 30 polls).
- Remote Linux machines over your own SSH config, with nothing installed on them: one shell probe, optional `nvidia-smi` and Docker readings.
- History in a local SQLite database, alerts, and in-app updates from GitHub Releases.
- Windows installers (NSIS and MSI) built by a tag-triggered release workflow that drafts a GitHub Release.
- One version number: the Cargo workspace version, checked against `app/package.json` by a wall.
- Repository set up: licence, contributing, security and design notes.
- Portable zip on every release: `portable.txt` next to the program keeps data beside it and turns off self-update.
- Signed self-updates: the project's update key is built in.
- The release can be started by hand from the Actions tab as well as by a tag.
