# Xero Systems Monitor

A small, always-on-top monitor for the machines you own: your Windows PC and the Linux boxes you reach over SSH.

[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/T3rM1nAt0-R/xero-systems-monitor?include_prereleases)](https://github.com/T3rM1nAt0-R/xero-systems-monitor/releases)
[![Platform: Windows 10/11](https://img.shields.io/badge/platform-Windows%2010%2F11-informational.svg)](#install)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app)

![The main window in the dark theme: one frosted card per machine, graphs sitting open](docs/screenshots/main.png)

The screenshots show made-up demo data, not a real machine.

## Features

One window shows CPU, memory, disk, network, GPU and temperatures, plus GitHub Actions self-hosted runner jobs and Docker containers, with history you can scroll back through. The window has its own slim title bar (View, More and the window buttons in one place; drag it to move, double-click to maximise) and thin scrollbars that only show while you scroll.

![The slim title bar with View, More and the window buttons](docs/screenshots/titlebar.png)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/activity.png" alt="The activity drawer"></td>
<td width="50%"><img src="docs/screenshots/machines.png" alt="The machines dialog"></td>
</tr>
<tr>
<td valign="top">Activity drawer (press <b>E</b>): runner jobs, alerts and events, newest first.</td>
<td valign="top">Machines dialog: add Linux machines by SSH host name, nothing installed on them.</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/compact.png" alt="The compact view"></td>
<td width="50%"><img src="docs/screenshots/light.png" alt="The light theme with frosted glass cards"></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/theme-dark.png" alt="Follow Windows in Customize: a Light slot and a Dark slot, here with Nord Polar Night showing while Windows is dark"></td>
<td width="50%"><img src="docs/screenshots/theme-light.png" alt="The same window after Windows goes light: Solarized Light takes over"></td>
</tr>
<tr>
<td colspan="2" align="center"><img src="docs/screenshots/mini.png" alt="The mini view: one frosted surface, a row per machine with number tiles" width="560"></td>
</tr>
<tr>
<td valign="top">Compact view (press <b>C</b>): one line per machine. There is also a mini corner view (<b>M</b>) you can drag to any size: one frosted surface, a tight row per machine with CPU, memory, GPU and temperature tiles; it shows 1 to 3 columns and remembers its size. Click a machine name to fold its card into one bar; <b>F</b> folds all, <b>Shift+F</b> opens all. Press <b>Ctrl+K</b> to search for a machine, group or setting; drag cards to reorder them.</td>
<td valign="top">Light and dark themes, or follow Windows.</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/view-control.png" alt="The view switch and View menu"></td>
<td width="50%"><img src="docs/screenshots/hidden-machines.png" alt="The hidden machines dialog"></td>
</tr>
<tr>
<td valign="top">One view switch: <b>Full | Compact | Mini</b>, a pin for keep-on-top (<b>T</b>), and a <b>View</b> menu with Fold all, the machines strip (Auto, On or Off) and Hidden machines.</td>
<td valign="top">Hide machines you do not need (the <b>⋯</b> on a card or strip tile). They leave every view and the tray summary; Hidden machines lists them with Show again and Pause monitoring.</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/customize.png" alt="The Customize panel docked beside the live window"></td>
<td width="50%"><img src="docs/screenshots/customized.png" alt="The Terminal style with the Shape section of the Customize panel"></td>
</tr>
<tr>
<td valign="top">Customize (More &gt; Look &gt; Customize…, or <b>Ctrl+K</b>) is the one place for the look, including dark or light (Appearance is One theme, or Follow Windows with a Light slot and a Dark slot that switch live with the system), the Windows accent colour and the text size (there is no separate Theme or Large text switch): a docked side panel (the window stays live beside it) with one scroll: a theme gallery in two groups, 12 dark and 7 light tiles, each with its own name and its own edits (Default, Solarized, Catppuccin, Gruvbox, Tokyo Night, Nord and Contrast come as real dark and light pairs; Terminal, Dracula, Neon, Midnight and Blueprint are dark only), three base colours that every other colour follows, a font, size and weight for each kind of text (12 bundled fonts), graph style, density (Tight, Comfortable, Roomy), five style families (Rounded, Sharp, Terminal, Soft, Blueprint; they change shape only, the green-on-black and blue-paper colours are the Terminal and Blueprint themes) with corner radius, borders and shadow, glass, a picture background, grain, and motion (Full, Subtle, Off). Search, a pick mode (click anything in the window to jump to its setting), undo and redo (Ctrl+Z / Ctrl+Y), and hold the eye to compare with how it looked when you opened the panel. Graphs roll their numbers, slide new points in and glow on the newest point and the highest point; cards glide, tabs slide, toasts confirm saves and copies, and risky actions (stop or restart a container, end a task, stop everything) need a hold.</td>
<td valign="top">The same window with the Midnight theme, other fonts, filled smooth graphs and a purple tint for one machine.</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/tabs-overview.png" alt="A machine card on its Overview tab"></td>
<td width="50%"><img src="docs/screenshots/tabs-runners.png" alt="The Runners tab"></td>
</tr>
<tr>
<td valign="top">Tabs on every machine card: Overview, Hardware, Processes, Disks, Network, Services and Runners (only the ones that machine has). Overview keeps the main graphs, a short runners block and any failing containers. Use the arrow keys to move between tabs; each machine remembers its tab. Hover the <b>i</b> in the header for the board, system and address.</td>
<td valign="top">The Runners tab: one table with a row per runner (status, current job, time in job) and that runner's own timeline lane (over the range chosen under "Graphs show") on a shared time axis, work folder size on demand, the queue, last 7 days, slowest jobs, the busy heatmap and job history. Click the pin on any section header to pin that section to Overview.</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/disks.png" alt="The Disks tab with drive speed graphs, drive health and the biggest folders"></td>
<td width="50%" valign="top">The Disks tab: read and write speed per drive, drive health (temperature, hours, SSD wear), and "Find biggest folders", a search you start yourself that shows a loading bar, can be stopped and never deletes anything.</td>
</tr>
<tr>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/hardware.png" alt="The Hardware tab"></td>
<td valign="top">The Hardware tab: each CPU core with its load and temperature, fans, clock and power, the battery (charge, charging, time left) on laptops, and the programs using the graphics card (NVIDIA) with the memory each holds. Linux machines show the per-core numbers too.</td>
<td width="50%"><img src="docs/screenshots/terminal.png" alt="The Terminal tab with two demo shells"></td>
<td valign="top">The Terminal tab: a real shell on every machine. PowerShell on this PC; on Linux machines it runs your own <code>ssh -t</code> (your ssh config and keys, nothing stored). Several sessions per machine as small tabs (+ and ×), your Customize colours and monospace font, <b>Ctrl+Shift+C</b> / <b>Ctrl+Shift+V</b> to copy and paste. Admin shells on This PC: <b>Admin shell…</b> opens the menu below (in the tab through Windows sudo, a separate admin window, or restart Xero as admin).<br><img src="docs/screenshots/admin-shell.png" alt="The Admin shell menu in the Terminal tab" width="360"><br>In <code>npm run dev</code> it is a demo shell (help, uptime, ls).</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/processes.png" alt="The Processes tab"></td>
<td valign="top">The Processes tab: the busiest processes, sortable and filterable. <b>End task</b> needs a press-and-hold, so it cannot happen by accident (Linux machines get a plain <code>kill</code> over ssh, never sudo). Below it, "What was busy" ranks the programs of the last hour, 6 hours or 24 hours by CPU or memory.</td>
<td width="50%"><img src="docs/screenshots/network.png" alt="The Network tab with adapters, the internet check and the ping map"></td>
<td width="50%" valign="top">The Network tab: adapters and Wi-Fi, an internet check every minute with a 24-hour up/down strip (you can change the address it checks), and a ping map of your other machines with a latency graph.</td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/overview-graphs.png" alt="The graph list in a machine's menu, the outage strip and the Unusual for this time chip"></td>
<td width="50%"></td>
</tr>
<tr>
<td valign="top">Choose your graphs: the ⋯ menu on a card lists its graphs with show/hide, size S/M/L and pin. Graphs get small markers for restarts, jobs (failed ones in red), container restarts and going offline; hover one for the time. A graph that is far above its usual level for this hour of the day shows "Unusual for this time". A thin strip under the tabs shows the last 24 hours or 7 days online, offline or without data.</td>
<td></td>
</tr>
</table>

- Admin shells on This PC: "Admin shell…" in the Terminal tab (in the tab through Windows sudo, a separate admin window, or restart Xero as admin), a red Admin badge when elevated, and More > Restart as admin / Always start as admin
- Terminal tab on every machine: PowerShell on this PC, `ssh -t` on Linux machines, several sessions, copy and paste with Ctrl+Shift+C / V
- Customize: a theme holds the whole look; built-in themes and popular palettes, "Custom (based on ...)" with Save, Save as new and Revert; rename, delete, copy code, export and import your own; a colour-blind safe switch (status also by shape); a colour per machine in its ⋯ menu tints its card edge and tile; a warning when text and background are hard to read together
- Network tab: adapters, Wi-Fi name and signal, an internet check with a 24-hour up/down strip, and a ping map of your other machines
- Disks tab: read and write speed of every drive over time, drive health (OK or needs a look, temperature, hours, SSD wear; on Linux it needs smartmontools), and a "Find biggest folders" search you start yourself, with a loading bar and a Stop button, that only reads and never deletes
- This PC: CPU, memory, disk, network, ping, top programs, network connections by program (Windows), GPU (NVIDIA), CPU temperature
- This PC with LibreHardwareMonitor running: fan speeds, CPU clock, CPU and GPU power, per-core load
- Smooth folds, tab changes and menus, a thin loading bar and graph placeholders while data arrives (all off with the system "reduce motion" setting)
- Every machine card: uptime, last restart time and "Restart needed for updates" (Debian/Ubuntu and Windows)
- Remote Linux machines over your own SSH config, no agent to install on them
- Runner insights: a busy-hours heatmap for the week, a searchable job history, and a click on any job opens it on GitHub (its pull request, or the Actions page)
- GitHub Actions self-hosted runner jobs on this PC and on remote machines: running, finished, failed, and how long they took (found on this PC by themselves; for a remote machine turn on "GitHub runners" when you add it)
- Logs tab: recent system log lines (journalctl or the Windows event log) with a priority filter, service filter, search and auto-refresh; container logs from the same tab
- Services tab: systemd services (Linux) and Windows services (This PC) with a filter and hold-to-confirm Restart, Stop and Start; pending updates, Install updates and Restart machine on Linux (`sudo -n`, or a command to copy if sudo needs a password)
- Docker containers and failed systemd services on remote machines, with Restart, Stop, Start and Logs buttons (the ssh user needs the docker group)
- History from 5 minutes to 1 year, stored locally in SQLite
- "What was busy then?": click a point on a CPU or memory graph to see the busiest programs at that moment (kept once a minute for 3 days)
- Graph tools: drag across a graph to zoom (every graph of that machine follows, double-click to reset), compare with yesterday or last week (dashed copy), open one graph full-window to overlay other machines, save a graph as a picture or CSV
- Alerts when a limit is crossed, a disk is about to fill, or a job fails
- Your own limits per machine (CPU %, CPU and GPU temperature, disk % and "full in N days"), quiet hours (11 PM to 8 AM by default; pop-ups wait except "machine offline"), and a Mute button on each alert in the Activity drawer
- Tray icon with a status dot (green all calm, amber something needs a look, red a machine is offline or a job or container failed) and a hover text like "3 calm, 1 needs a look · CPU 23%"; autostart
- Updates itself from GitHub Releases (when you ask it to check)

Windows first. Linux and macOS later.

## Install

1. Open the [Releases page](../../releases) and download the latest installer: the `.exe` (NSIS) or the `.msi`.
2. Run it. Windows SmartScreen may say "Windows protected your PC / unknown publisher". The installers are not code signed yet (signing is planned, see [docs/releasing.md](docs/releasing.md)). Choose **More info**, then **Run anyway**.
3. Nothing else is needed: WebView2, which draws the window, is built into Windows 10 and 11.

The installed app checks GitHub for new versions and updates itself (More > Check for updates). Each update is signed, and the app refuses one that is not.

**Portable copy:** download `Xero.Systems.Monitor_<version>_x64_portable.zip`, unzip it anywhere (a USB stick works) and run `Xero Systems Monitor.exe`. The `portable.txt` file beside it keeps settings and history in a `data` folder next to the program. A portable copy does not update itself: download the new zip and copy your `data` folder across.

## Adding machines

Add a Linux machine in the app by the **SSH host name** from your `~/.ssh/config` (the app runs your system `ssh`, so users, ports, jump hosts and keys work as they do in your terminal).

- Log in with a key (or an agent). The app never asks for or stores a password, and a prompt would fail the connection.
- Nothing is installed on the server. The app sends a small shell probe over one long-lived SSH connection. The server only needs a POSIX `sh`.
- `nvidia-smi` and `docker` are optional: GPU and container cards appear only when the server has them. GPU use and memory on a server are the peak of a few quick samples per check, and the GPU graphs keep peaks on long ranges, so short bursts show.

Test it first: `ssh your-host true` must work without a prompt.

## CPU temperature

Windows does not give CPU temperature to normal programs. The app tries, in order:

1. The system sensors, when the machine exposes them.
2. [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor), if you run it with its remote web server on (port 8085).
3. The Windows ACPI thermal zone (read through WMI by a hidden PowerShell call every few minutes). Many PCs report nothing useful here; the app then shows "not available".

## Privacy

Everything stays on your computer. The app talks only to the machines you add and, when you check for updates, to GitHub. No telemetry, no account.

## Development

The one check (also what CI runs on Windows and Linux):

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace          # includes the walls
cd app && npm ci && npm test && npm run lint
```

- Browser demo of the window with made-up data: `cd app && npm run dev`
- The desktop app: `cargo tauri dev` (needs `cargo install tauri-cli --version "^2" --locked`). Set `XSM_DEMO=1` to run on made-up data instead of live readings.
- Where things live: [docs/architecture.md](docs/architecture.md). Rules for code: [AGENTS.md](AGENTS.md). Releases: [docs/releasing.md](docs/releasing.md).

See [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: see [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE). Bundled third-party parts are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
