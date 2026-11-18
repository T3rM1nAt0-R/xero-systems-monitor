# Changelog

All notable changes are listed here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions: [SemVer](https://semver.org/).

## [Unreleased]

- Added: the Services tab now also lists the machine's own services (systemd on Linux, Windows services on This PC) with a Failed / Running / Stopped filter and Restart, Stop and Start buttons you hold for a moment to confirm. Linux machines show how many updates are waiting (looked up every 30 minutes), "Restart needed", Install updates and Restart machine. Linux actions use `sudo -n` only; if sudo needs a password the app shows the command to run yourself, with a Copy button, and never stores a password.
- Added: choose your graphs. The ⋯ menu on a machine card lists its graphs with show/hide on Overview, a size (S, M, L) and a pin (a pinned graph always shows and comes first). Remembered per machine.
- Added: small markers on graphs for restarts, runner jobs starting and ending (failed ones red), container restarts and going offline or back online; hover one for what happened at a 12-hour time.
- Added: "Unusual for this time" chip on a CPU, memory or GPU graph that is far above what that machine usually does at this hour over the last 7 days ("normally ~X%"); the threshold is in `app/src/unusual.json`.
- Added: an outage strip under the tabs, 24 h or 7 d, showing online, offline and no-data stretches with hover times.
- Added: the Processes tab. A live list of the 50 busiest processes (name, ID, CPU, memory, and the user on Linux machines) that you can sort by any column and filter by a word, refreshed every 3rd poll. **End task** on each row only acts when you press and hold it for about 0.8 seconds (a fill shows the progress), then a small message tells you what happened. This PC ends the program; a Linux machine gets one plain `kill <id>` over ssh (the polite stop signal, never sudo). On This PC a program whose name changed since the list was drawn is left alone.
- Added: "What was busy" on the Processes tab: the programs that used the most CPU or memory over the last hour, 6 hours or 24 hours, as a ranked list with small bars. History now keeps, every minute, the 5 busiest programs by CPU and the 5 biggest by memory.
- Added: Network tab: adapters with up or down, speed and address (the address only appears in the window), Wi-Fi name and signal on This PC, an internet check every minute (DNS lookup plus an HTTPS HEAD to a host you can change, default a generic Google endpoint) with up or down, delay and a 24-hour strip, and a ping map: This PC pings every other machine about every 30 seconds and shows a tile per machine and a latency graph. Connections by program stay on this tab.
- Added: Disks tab: read and write speed of every drive as graphs (kept in the history), drive health (OK or needs a look, temperature, hours powered on, wear for SSDs; read every 10 minutes, with a hint to install smartmontools on Linux), and an on-demand "Find biggest folders" search for a drive or folder that shows a loading bar, can be stopped and never deletes anything.
- Added: the Hardware tab now lists every CPU core with its load and temperature (Linux machines too, read from /proc/stat and the coretemp sensor), fans and clock on Linux, the battery (charge, charging or not, time left) on any machine that has one, and which programs are using the NVIDIA graphics card with the memory each holds. The Linux probe reads the extra facts without adding commands to every frame; the GPU program list is asked only on the process-list frames.
- Added: a real terminal on each machine's Terminal tab: PowerShell on this PC, `ssh -t` (your own ssh client and keys) on Linux machines, several sessions per machine as small sub-tabs, your Customize monospace font and colours, Ctrl+Shift+C / Ctrl+Shift+V to copy and paste. The terminal code loads only when the tab opens. `npm run dev` shows a demo shell (help, uptime, ls).
- Added: tabs on every machine card (Overview, Hardware, Processes, Disks, Network, Services, Runners; Logs is ready in the registry for later). Only tabs with content show, each machine remembers its tab, arrow keys move between them. Overview keeps CPU, memory and GPU graphs, network and disk summary graphs, a compact runners block and failing containers only.
- Added: a pin on every section header pins that section (whole) to Overview; click again to unpin.
- Changed: the machine card header is one status line (name, status, uptime, restart needed); board, system and address moved to a hover tooltip on an (i) icon.
- Added: smooth fold and unfold of machines and sections, tab cross-fade, menus and dialogs fading in, a thin loading bar for the first load and for history fetches, and shimmer placeholders on graphs before their first data. All of it stops when the system asks for reduced motion.
- Added: Customize… (More > Look, or Ctrl+K) with a live preview. Text: a font, size and weight for the machine name, section header, group header, big numbers, labels and small text, from 12 bundled open-licence fonts (Inter, Roboto, IBM Plex Sans, Source Sans 3, Nunito, Poppins, Montserrat, Lato, Fira Sans, Space Grotesk, JetBrains Mono, Fira Code) or System. Colours: accent, background, card, text, dim text, border, good, warning, bad, every graph colour, and one colour per machine (tints its card edge and tile). Graphs: line, filled area or bars, line width, grid lines, smoothing, limit lines. Size: Small, Medium or Large graphs, Compact, Comfortable or Spacious spacing, and a text scale. Themes: Dark, Light, Midnight, Solarized-like, High contrast and Neon, plus save, rename, delete, export and import of your own. Warns when text and background contrast is under 4.5. The fonts add about 455 KB to the installer.
- Changed: the four top buttons (Fold all, On top, Compact, Mini) are now one **Full | Compact | Mini** switch, a pin button (Keep on top, T) and a View menu (Fold all / Unfold all, Machines strip, Hidden machines). Keyboard shortcuts are unchanged.
- Added: Machines strip setting Auto / On / Off (Auto hides it when there is one machine or every card fits the window; it slides in and out).
- Added: hide a machine from the ⋯ on its card or strip tile; hidden machines leave the strip, cards, compact view and tray summary. The Hidden machines dialog and Ctrl+K ("Show hidden machine X") bring them back, and Pause monitoring stops polling a machine (new optional `paused` flag in `machines.json`).

- Changed: internal: the window draws its sections from one registry (`app/src/sections/`), the group lists come from it, and one settings store with subscribe replaces the separate fold, group and reveal event buses; each machine has a stable settings object (colour, tab, pinned sections) ready for tabs and themes. The Groups menu now also offers GPU when the history shows GPU use, matching what is drawn. Behaviour is otherwise unchanged.
- Changed: internal: the window's styles are split into `app/src/styles/` feature files on top of a token file (every colour, font, size, radius and space is a custom property, dark and light); duplicate and dead rules and `!important` fights are gone; Large text uses a size scale instead of `zoom`; graph colours come from the CSS variables. Fixed on the way: the full-window graph is tall again (it was one short strip), and compact rows no longer pick up the connections list's grid layout.
- Fixed: the app stays responsive while a container action waits on ssh or a long history is read (blocking work moved off the shared runtime, reads use their own database connection); the Linux probe takes about 0.5 s per cycle instead of 4 s with a GPU and a running job (GPU sampled in the background, no fixed sleeps, docker stats every third cycle); container logs are capped at 64 KB per stream; web links with `..` are refused.
- Fixed: dragging on a graph to zoom no longer also opens "What was busy then?"; the Disk graph now uses the same graph card as every other metric.
- Changed: internal clean-up from the code review: one way to pass limits (`limitsOf(name)`), machine "last seen" and "CPU high since" are worked out by a pure tested helper, cards and graph panels get stable props so they skip needless redraws, hook dependency warnings are on.
- Added: an Actions workflow, Publish release, that publishes a draft release by its tag after checking it has `latest.json`.

## [0.2.0] - 2026-11-18

- Fixed: polish after review: the machines strip is one compact row of tiles; the "What was busy then?" box no longer stays open under the hover readout, stays inside the window and no longer closes by itself on each refresh; sub headers share one small style (for example "DRIVES  2 drives"); folded group summaries are smaller; the Picture and CSV buttons show only on hover, away from the limit label; the stray line under a folded machine bar is gone; clicking a machine tile no longer also unfolds machines whose names start the same.

- Added: "Network connections by program" in This PC's Network group (Windows): how many TCP connections and UDP sockets each program has open, top 8, refreshed about every 10 seconds. It counts connections, not data sent, because Windows only reports bytes per program to an administrator.
- Added: the tray icon now shows how things are: a green, amber or red dot on the icon, and a hover text such as "Xero Systems Monitor · 3 calm, 1 needs a look · CPU 23%". Red means a machine is offline, a container or service is failing, or a job failed that you have not looked at yet.
- Added: "What was busy then?" Click any point on a CPU or memory graph to see the busiest programs at that moment (name, CPU, memory). The top 10 programs are kept once a minute for 3 days. Hover works as before.
- Added: a machines strip at the top of the main window, one small tile per machine (This PC first) with status, CPU, memory, GPU, temperature and a tiny CPU line. Offline tiles go grey with the time last seen. Click a tile to jump to that machine's card.
- Added: Ctrl+K search. Jump to a machine or one of its groups, or change a setting or the time range, from the keyboard.
- Added: drag a machine card by its header to reorder; a "Groups..." option on each card hides groups you never use and moves the rest up or down. Both are remembered.
- Changed: tighter spacing between groups, larger folded summaries, and the runner chips scroll sideways on one line.
- Busy this week is now a heatmap: one row per day, one cell per hour (12-hour labels), darker when the runners were busier; hover a cell for the hour, how busy and the jobs and failures in it. A line per day lists its jobs and failures.
- Click a job to open it on GitHub: running jobs, timeline bars, slowest jobs and failed jobs in Activity open the pull request, or the repository's Actions page when it is not a pull request. Jobs recorded before this update have no owner in their name and are not clickable.
- Job history in the Runners group: the last 100 jobs of the machine, newest first, with search and result and workflow filters.
- A finished job's label now names the repository as owner/name.
- Added: drag across a graph to zoom all of that machine's graphs; double-click or "Reset zoom" returns.
- Added: a "Compare" choice in the bottom bar (off / yesterday / last week) draws a faint dashed copy of each graph from the earlier time.
- Added: click a graph title to open it full-window and overlay the same metric from other machines (Esc closes).
- Added: each graph can be saved as a picture (PNG) or its numbers as a CSV file (local 12-hour times).
- Added: containers on remote machines have Restart, Stop or Start (asks first) and Logs (last 50 lines, with Refresh and Copy).
- Uptime and restart status: each machine card shows how long it has been on and when it last restarted, and "Restart needed for updates" in amber when the system says so (Debian and Ubuntu over ssh, and Windows on This PC). Other systems show no restart line.
- Fixed: short GPU bursts on Linux machines are no longer missed. The probe now takes four quick GPU samples per check and reports the peak use and peak memory. The history graph keeps the peak (not the average) of GPU and GPU memory when it thins old data, so short peaks stay visible on long ranges. CPU and the other graphs still show averages. This PC reads the GPU once per poll and is unchanged.
- Added: everything folds. Each machine card folds into one bar (status, CPU, temperature, memory, GPU, disk, runners busy, failing containers, and a tiny CPU line); the small sections (Timeline, Last 7 days, Slowest jobs, Busy per day, Busiest programs, Drives) fold on their own and are remembered. "Fold all" / "Unfold all" button, keys F and Shift+F, and a More menu switch "Fold calm machines". Busy per day starts folded.
- Added: More > Limits… sets your own CPU %, CPU temp, GPU temp, disk % and "disk full in N days" limits for each machine (or the same for all). Colours, the red lines on the graphs and the alerts use them. The standard limits are unchanged.
- Added: Quiet hours (More > Notify me when…, default 11 PM to 8 AM). Pop-ups wait during quiet hours except "A machine goes offline"; they still appear in Activity marked "(quiet hours)".
- Added: a Mute button on each alert in the Activity drawer stops that kind of alert for that machine; a "Muted alerts" list in the menu unmutes it.
- More hardware detail on This PC when LibreHardwareMonitor is running: fan speeds, CPU clock, CPU and GPU power, and a thin bar per CPU core, in the CPU group.

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
