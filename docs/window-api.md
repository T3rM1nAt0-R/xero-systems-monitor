# Window API: the commands the window calls

The window (`app/`) talks to the backend only through `app/src/api.js`. Each function there is one Tauri command, called with `invoke` from `@tauri-apps/api/core`. The shell (`src-tauri`) implements exactly this list. Outside Tauri, `app/src/fakeBackend.js` answers the same commands with demo data, and `app/test/fakeBackend.test.js` checks that its answers have the shapes below and that every command here is handled.

Rules for every command:

- Command names are `snake_case`. Argument names are single lowercase words, so camelCase/snake_case conversion never matters.
- Times are unix seconds (numbers, may have decimals). Percentages are 0 to 100.
- A command that fails rejects with a plain text message; the window shows it.
- Pushed by the shell (not commands): the events `window-mode` (payload `"mini"`, `"full"` or `"compact"`) and `pinned` (payload `true` or `false`), sent when the tray menu changes them.

## Commands

| Command | Arguments | Returns |
| --- | --- | --- |
| `get_state` | none | `{ machines: Machine[] }` |
| `get_history` | `machine: string`, `range: number` (seconds, 1 to 400 days) | `History` |
| `get_events` | `since: number`, `n: number` | `Event[]`, newest first, at most `n` |
| `get_jobs` | `since: number` | `Job[]`, oldest first, finished jobs that ended at or after `since` |
| `get_forecast` | `machine: string` | `{ per_day: number or null, days: number or null }` |
| `get_machines` | none | `{ machines: MachineConfig[] }` |
| `save_machines` | `machines: MachineConfig[]` | `{}` when saved (the collector restarts), or `{ error: string }` and nothing saved |
| `get_prefs` | none | `Prefs` |
| `set_prefs` | `patch: Partial<Prefs>` (only `closeToTray` and `login` can change) | the new `Prefs` |
| `set_window_mode` | `mode: "mini" or "full" or "compact"` | the mode now in effect |
| `set_pinned` | `on: boolean` (always on top) | the pin now in effect (boolean) |
| `set_theme` | `theme: "light" or "dark"` (title-bar buttons follow it) | `null` |
| `set_mini_height` | `height: number` (CSS pixels; in mini mode the window follows its content, growing upward) | `null` |
| `check_for_updates` | none | `true` an update is waiting, `false` up to date, `null` could not check |
| `apply_update` | none | `true` installed (restart to finish), `"dirty"` local edits block it, `false` failed |
| `get_version` | none | `{ version: string, date: number, packaged?: boolean }` (`date` 0 when unknown) |
| `restart_collector` | none | `null` |
| `relaunch` | none | `null` (the app restarts) |
| `stop_everything` | none | `null` (collector and window close) |
| `quit` | none | `null` (the window closes, the app exits) |

`set_window_mode`: `mini` is the small always-on-top corner window; `full` and `compact` are the normal window (compact is the one-row-per-machine layout, which the window draws itself; the shell may remember the size per mode). Leaving `mini` restores the earlier size and place.

## Shapes

```
Machine = {
  name: string,
  err: string or null,            // null when reachable
  t: number or null,              // when the machine last answered
  d: Reading,                     // last reading; {} before the first one
  started: { [runner]: number },  // runner -> when its current job began
  gone: string[],                 // runners that stopped reporting
  cgone: [name, t, state, text, image][]   // containers that disappeared
}

Reading = {                       // every field optional; absent means "not measured"
  cpu, temp, ram, disk, gpu, gtemp, vram: number,   // % (temps in C)
  down, up: number,               // bytes per second
  ping: number,                   // ms
  speed: number,                  // link, Mbps
  uptime: number,                 // seconds
  ip: string,
  ram_gb: [used, total], vram_gb: [used, total],
  storage: [name, used_gb, total_gb][],
  hw: { board?, os?, cpu?, gpu? },
  top: [name, cpu_percent, ram_mb, count][],
  runners: { [runner]: boolean }, // present only on machines with runners; true = busy
  jobs: { [runner]: [workflow, _, ref, repo] },
  jobres: { [runner]: [cpu_percent, ram_mb, gpu_mb, gpu_percent] },
  docker: [name, state, text, image, ports, created][], docker_err: string,
  failed: string[]                // failed systemd units
}

History = { cpu, ram, disk, temp, gpu, vram, gtemp, down, up, ping: [t, value][], loss: number or null }
          // up to about 400 points per series, oldest first; a series the machine lacks is []; {} for an unknown machine

Event = [t, machine, message]
Job = [machine, runner, start, end, result, label]   // result "" when unknown

MachineConfig = { name: string, kind: "local" or "ssh", host?: string, runner?: boolean, was?: string }
          // `was` is the old name after a rename, so the collector moves the history over
          // save_machines checks: at least one machine; names unique, non-empty, without "|"; every ssh machine has a host

Prefs = { closeToTray: boolean, login: boolean, packaged: boolean }
```
