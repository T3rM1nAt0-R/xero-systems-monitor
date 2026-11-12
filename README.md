# Xero Systems Monitor

A small, always-on-top desktop monitor for the machines you own: your PC and the Linux boxes and home servers you reach over SSH. One window shows CPU, memory, disk, network, GPU and temperatures, plus GitHub Actions self-hosted runner jobs and Docker containers, with history you can scroll back through.

> Status: early design. Nothing to install yet. The design lives in [docs/design.md](docs/design.md).

## Planned features (v1)

- This PC: CPU, memory, disk, network, GPU (NVIDIA first), CPU temperature (optional helper, see below)
- Remote Linux machines over your own SSH config, no agent to install on them
- GitHub Actions self-hosted runner jobs: running, finished, failed, and how long they took
- Docker containers and failed systemd services on remote machines
- History from 5 minutes to 1 year, stored locally in SQLite
- Alerts when a limit is crossed, a disk is about to fill, or a job fails
- Compact and mini views, tray icon, light and dark themes

Windows first. Linux and macOS later.

## Privacy

Everything stays on your computer. The app talks only to the machines you add and, if you turn it on, GitHub's update feed. No telemetry, no account.

## CPU temperature on Windows

Windows does not give CPU temperature to normal programs. Reading it needs a kernel driver. The optional **sensors helper** uses [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) (MPL-2.0) for this. It is off by default and asks for administrator rights once when you turn it on. Without it, the app shows the ACPI thermal-zone reading where Windows has one.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: see [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE). Bundled third-party parts are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
