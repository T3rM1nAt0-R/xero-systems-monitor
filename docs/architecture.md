# Architecture: the block map

Every block has one job and may use only what this table allows. The `block_map` wall reads each `Cargo.toml` and fails when a block depends on something not listed here. A new block adds its row here first.

| Block | Kind | One job | May use |
| --- | --- | --- | --- |
| `crates/xsm-core` | pure | The reading model, probe-text parsing, tracking events and jobs, alerts, disk-full forecast. No I/O, no clock (time is passed in), no threads. | `serde`, `serde_json` |
| `crates/xsm-settings` | pure | Reads the named-number settings files (`settings/*.json`) and the machine list. One front door: `Settings::load`. | `xsm-core`, `serde`, `serde_json` |
| `crates/xsm-store` | edge | SQLite history, jobs table, daily backup, retention. | `xsm-core`, `rusqlite` (bundled) |
| `crates/xsm-sources` | edge | Getting raw readings: this PC (`sysinfo`, NVML, Windows APIs), Linux machines over one long-lived `ssh` per machine running `probes/probe.sh`. | `xsm-core`, `xsm-settings`, `sysinfo`, `nvml-wrapper`, `windows` (Windows only) |
| `crates/xsm-collector` | edge | The polling loop: sources to tracker to store, every N seconds; one snapshot for the window. | all blocks above |
| `src-tauri` | shell | The desktop app: Tauri commands (the only front door the window sees), tray, autostart, mini window, single instance, updater. | `xsm-collector`, `xsm-settings`, `tauri` and its official plugins |
| `app/` | window | React + Vite window. Talks only through `app/src/api.js`, which wraps Tauri `invoke`. | `react`, `@tauri-apps/api` |
| `probes/` | script | `probe.sh`, sent over SSH; prints one tagged line per fact. | POSIX sh only |
| `crates/xsm-walls` | checks | The house rules, as tests. | `syn`, `walkdir`, `toml`, `regex` |
| `helpers/sensors/` | later | Optional C# CPU-temperature helper (LibreHardwareMonitorLib). | not built yet |

Pure blocks: `xsm-core`, `xsm-settings`. Everything that touches files, network, processes or the clock lives in an edge block.

## Data flow

```
probe.sh / local APIs  ->  xsm-sources (raw text or struct)
                       ->  xsm-core::parse  -> Reading
                       ->  xsm-core::Tracker (latest, events, jobs) + xsm-core::alerts
                       ->  xsm-store (history)      xsm-collector snapshot
                       ->  src-tauri commands  ->  app/src/api.js  ->  React
```

## One home per job

`walls/one-home.txt` names each job and the one file allowed to do it (for example: formatting bytes for display = `app/src/format.js`; parsing probe lines = `crates/xsm-core/src/parse/`; opening the database = `crates/xsm-store/src/db.rs`). The `one_home` wall fails when another file does that job.
