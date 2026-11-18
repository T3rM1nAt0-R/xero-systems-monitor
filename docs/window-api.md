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
| `get_busy_at` | `machine: string`, `t: number` (unix seconds) | `BusyAt`, or `{}` when no programs were kept near `t` |
| `get_events` | `since: number`, `n: number` | `Event[]`, newest first, at most `n` |
| `get_jobs` | `since: number` | `Job[]`, oldest first, finished jobs that ended at or after `since` |
| `get_forecast` | `machine: string` | `{ per_day: number or null, days: number or null }` |
| `get_machines` | none | `{ machines: MachineConfig[] }` |
| `save_machines` | `machines: MachineConfig[]` | `{}` when saved (the collector restarts), or `{ error: string }` and nothing saved |
| `container_action` | `machine: string, action: "restart" or "stop" or "start" or "logs", name: string` (an ssh machine; the name must match `[a-zA-Z0-9][a-zA-Z0-9_.-]*`) | text: the last 50 log lines for `logs`, else a short sentence. Runs one `docker <action> <name>` over its own `ssh` (20 second limit); a failure is a plain-words error (for example the ssh user needs the docker group) |
| `system_query` | `machine: string, query: "services" or "updates"` | text. `services`: systemd's `systemctl list-units --type=service --all --plain --no-legend` on a Linux machine, or PowerShell's `Get-Service` as JSON (`Name, DisplayName, Status, StartType`) on This PC. `updates`: `apt N` or `dnf N` (pending updates) or `none`; an error on This PC. 20 second limit |
| `system_action` | `machine: string, act: "restart" or "stop" or "start" or "upgrade" or "reboot", name: string` (a service name matching `[A-Za-z0-9_.@:-]+`; empty for `upgrade` and `reboot`, which are Linux only) | a short sentence. Linux runs `sudo -n ...` only and never stores a password: if sudo needs one the error is `needs-password:` followed by the command to run by hand. This PC runs `Restart-Service`, `Stop-Service` or `Start-Service`. Installing updates may take 10 minutes |
| `get_prefs` | none | `Prefs` |
| `set_prefs` | `patch: Partial<Prefs>` (only `closeToTray` and `login` can change) | the new `Prefs` |
| `set_window_mode` | `mode: "mini" or "full" or "compact"` | the mode now in effect |
| `set_pinned` | `on: boolean` (always on top) | the pin now in effect (boolean) |
| `set_theme` | `theme: "light" or "dark"` (title-bar buttons follow it) | `null` |
| `set_tray_status` | `status: "calm" or "look" or "bad"` (green, amber or red dot on the tray icon), `tooltip: string` (the tray hover text) | `null`; an error text for any other status |
| `set_mini_height` | `height: number` (CSS pixels; in mini mode the window follows its content, growing upward) | `null` |
| `check_for_updates` | none | `true` an update is waiting, `false` up to date, `null` could not check |
| `apply_update` | none | `true` installed (restart to finish), `"dirty"` local edits block it, `false` failed |
| `get_version` | none | `{ version: string, date: number, packaged?: boolean }` (`date` 0 when unknown) |
| `restart_collector` | none | `null` |
| `relaunch` | none | `null` (the app restarts) |
| `stop_everything` | none | `null` (collector and window close) |
| `quit` | none | `null` (the window closes, the app exits) |
| `open_link` | `url: string` (must start with `https://github.com/` and hold only letters, digits and `. _ - /`; anything else is refused) | `null` (the address opens in the browser) |

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
  restart: boolean,               // a restart is waiting for updates; absent when not known (see below)
  restart_pkgs: number,           // how many packages asked for it, when known
  updates: number,                // updates waiting, when known
  ip: string,
  mhz: number,                    // CPU clock, average over cores (MHz). mhz, cpu_w, gpu_w, fans and cores come from
  cpu_w, gpu_w: number,           // package power, watts. LibreHardwareMonitor and are absent when it is not running
  fans: number[],                 // fan speeds, RPM
  cores: number[],                // load of each CPU core, %
  ram_gb: [used, total], vram_gb: [used, total],
  storage: [name, used_gb, total_gb][],
  hw: { board?, os?, cpu?, gpu? },
  top: [name, cpu_percent, ram_mb, count][],
  conns: [name, connections][],   // This PC on Windows only: open TCP connections plus UDP sockets per program, most first, at most 8, refreshed about every 10 s (counts, not data: bytes per program need administrator rights)
  runners: { [runner]: boolean }, // present only on machines with runners; true = busy
  jobs: { [runner]: [workflow, _, ref, repo] },
  jobres: { [runner]: [cpu_percent, ram_mb, gpu_mb, gpu_percent] },
  docker: [name, state, text, image, ports, created][], docker_err: string,
  failed: string[]                // failed systemd units
}

Restart status: Debian and Ubuntu machines report it from `/var/run/reboot-required` (and its `.pkgs` list), and the
update count from `apt-check` when that is installed (read about every 100th frame). This PC on Windows reads the two
"restart pending" registry keys with `reg query`. Any other system leaves `restart` out: unknown, not "no".

History = { cpu, ram, disk, temp, gpu, vram, gtemp, down, up, ping: [t, value][], loss: number or null }
          // up to about 400 points per series, oldest first; a series the machine lacks is []; {} for an unknown machine

BusyAt = { t: number, top: [name, cpu_percent, ram_mb, count][] }
         // the busiest programs of the stored minute nearest to the asked time (within 2 minutes), busiest first, at most 10;
         // kept once a minute for 3 days (as long as the 1-minute history); names have spaces shown as `_`

Event = [t, machine, message]
Job = [machine, runner, start, end, result, label]   // result "" when unknown; label "PR #7 · branch · Build (owner/name)" (the last part is the repository, which the window turns into a GitHub link)

MachineConfig = { name: string, kind: "local" or "ssh", host?: string, runner?: boolean, was?: string, paused?: boolean }
          // `was` is the old name after a rename, so the collector moves the history over
          // `paused: true` keeps the machine in the list but the collector does not poll it (it is missing from get_state until resumed);
          //   the window sets it from "Hidden machines > Pause monitoring". Which machines are *hidden* is only a window setting.
          // save_machines checks: at least one machine; names unique, non-empty, without "|"; every ssh machine has a host

Prefs = { closeToTray: boolean, login: boolean, updates: boolean }  // updates: the More menu shows Check for updates (installed, not portable)
```

## Looking further back (graph compare)

`get_history` always ends now, and it has no "end" argument. The window's "Compare: yesterday / last week" asks for `range + 86400` (or `+ 604800`) seconds and then cuts out the older part itself (`app/src/graphTools.js`, `shiftSeries`), sliding it forward onto today's clock. No backend change was needed. The cost: the roughly 400 points are spread over the longer span, so the dashed copy is coarser than the live line, most visibly on the 5 minute and 1 hour ranges.

Saving a graph uses a plain browser download (a link with the `download` attribute); the shell needs no dialog plugin or extra permission for it.
