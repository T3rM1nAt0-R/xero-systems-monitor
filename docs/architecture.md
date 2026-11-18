# Architecture: the block map

Every block has one job and may use only what this table allows. The `block_map` wall reads each `Cargo.toml` and fails when a block depends on something not listed here. A new block adds its row here first.

| Block | Kind | One job | May use |
| --- | --- | --- | --- |
| `crates/xsm-core` | pure | The reading model, probe-text parsing, tracking events and jobs, alerts, disk-full forecast. No I/O, no clock (time is passed in), no threads. | `serde`, `serde_json` |
| `crates/xsm-settings` | pure | Reads the named-number settings files (`settings/*.json`) and the machine list. One front door: `Settings::from_json` (callers read the files and pass the text in). | `xsm-core`, `serde`, `serde_json` |
| `crates/xsm-store` | edge | SQLite history, busiest programs per minute, jobs table, daily backup, retention. | `xsm-core`, `rusqlite` (bundled) |
| `crates/xsm-sources` | edge | Getting raw readings: this PC (`sysinfo`, NVML, Windows APIs, CI runner processes and their worker logs, written as probe lines), Linux machines over one long-lived `ssh` per machine running `probes/probe.sh`. | `xsm-core`, `xsm-settings`, `sysinfo`, `nvml-wrapper`, `windows` (Windows only; the IP Helper connection tables) |
| `crates/xsm-collector` | edge | The polling loop: sources to tracker to store, every N seconds; one snapshot for the window. Also the shell's front door: the `Backend` trait (one method per data command) and `DemoBackend`; it re-exports the `xsm-core` types the commands return, because the shell may not use `xsm-core` directly. | all blocks above, `serde`, `serde_json` |
| `src-tauri` | shell | The desktop app: Tauri commands (the only front door the window sees), tray, autostart, mini window, single instance, updater. | `xsm-collector`, `xsm-terminal`, `xsm-settings`, `serde`, `serde_json`, `tauri` and its official plugins (`autostart`, `opener`, `single-instance`, `updater`, `window-state`) |
| `app/` | window | React + Vite window. Talks only through `app/src/api.js`, which wraps Tauri `invoke`. | `react`, `@tauri-apps/api` |
| `probes/` | script | `probe.sh`, sent over SSH; prints one tagged line per fact. The `GPU` line carries the peak use and peak memory of the samples one background `nvidia-smi -lms` took while the frame ran (`GPU_GAP_MS` at the top of the script), so nothing sleeps for it. Job resources use the change since the last frame (no sleep), and `docker stats` run only every third frame (`D=1`), the other frames reuse the last answer; the sender keeps a scratch folder (`T`) for the whole connection for this. The line format is unchanged. The store keeps the peak, not the average, for the `gpu` and `vram` series when it thins history. | POSIX sh only |
| `crates/xsm-terminal` | edge | The Terminal tab's shells: one pseudo-terminal per session id (`portable-pty`), running this PC's PowerShell (`pwsh`, else Windows PowerShell) or the user's own `ssh -t` to a configured machine. Pure parts: which program to run, id and size checks, cutting output into whole characters. Sessions end when closed and when the app quits. | `portable-pty` |
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

Commands that wait on the database or on `ssh` (history, busy-at, events, jobs, forecast, save machines, container actions, restart, stop) run through `spawn_blocking` in `src-tauri/src/commands.rs`, so a slow one cannot starve the shared async runtime. The window's reads use their own read-only-in-practice SQLite connection (WAL), so a long history read never holds up the poller's writes.

## Window styles: tokens first

The window's CSS lives in `app/src/styles/`, imported in this order from `main.jsx`:

| File | Holds |
| --- | --- |
| `tokens.css` | Every colour, font, size, radius and space as a custom property on `:root`, for dark and light. Nothing else. |
| `base.css` | Reset, buttons, top and bottom bars, status dots. |
| `card.css` | Machine cards, section groups, graph rows, meters. |
| `graphs.css` | Graph panels, charts, axis, tooltips, "What was busy then?". |
| `sections.css` | Runners, containers and services, programs, connections, sub headers. |
| `compact.css` | Compact view and the machines strip. |
| `menus.css` | Menus, dialogs, palette, Activity drawer. |
| `motion.css` | Folds, tab row and tab fade, pin and (i) icons, menu pop-in, top loading bar, graph skeleton, reduced-motion switch-off. |

Rules for the styles:

- **No literal colour, font family or font size outside `tokens.css`.** The metric colours are `--c-cpu`, `--c-temp`, `--c-ram`, `--c-gpu`, `--c-gtemp`, `--c-vram`, `--c-down`, `--c-up`, `--c-ping`, `--c-disk`; the state colours are `--ok`, `--warn`, `--crit`, `--busy`, `--bad`. JSX passes a metric key (`metricVar("cpu")` gives `var(--c-cpu)`), never a hex value.
- **Named text levels.** Machine name (`--font-machine`, `--size-machine`), group header (`--font-group`, `--size-group`, the small sub headers such as Drives), section header (`--font-section`, `--size-section`, CPU, Network, Disk...), big numbers, labels (graph titles) and small text each have their own family and size. Sizes that belong to no level use the numbered scales `--fs-N`, `--sp-N` (padding, margin, gap), `--r-N` (radius) and `--sz-N` (fixed sizes); each is N pixels times `--scale`.
- **Text size is `--scale`**, set from the Customize text size slider (the old Large text switch became 116% of it). The old `zoom` is gone, so graph hover positions stay correct. One-pixel hairlines (borders) do not scale.
- **Code that needs a real colour value** (shades for compared machines, canvas export) reads it through `app/src/colors.js`, which calls `getComputedStyle` once and again only when the theme, size or inline style of `<html>` changes. A card that sets its own `--c-*` values on its element is picked up with `readColors(element)`.
- Each selector has one rule. Later "override" blocks, `!important` (kept only for `[hidden]` and the drag cursor) and the old `.inline` qualifier are gone; to change a look, edit the rule, do not add another.

## Window sections and settings

- **Section registry** (`app/src/sections/`). `meta.js` is the one list of the sections a machine card can show (CPU, GPU, Network, Disk, Runners, Containers & services) and of the tabs they belong to. Each entry is `{ id, title, tab, spark, def, cls, accent(m, x), available(m, h), sub(m, x), summary(m, x) }`; it is pure, so `order.js` (group order, hidden groups, Groups menu), the Ctrl+K palette and the tests all read it. The body of each section is its own file next to it (`Cpu.jsx`, `Gpu.jsx`, `Net.jsx`, `Disk.jsx`, `Runners.jsx`, `Services.jsx`); `index.js` joins the two into `SECTIONS`. `Detail.jsx` draws `SECTIONS` in the order the layout gives; which slice of a section each tab shows is in `tabs.js` (pure): `TAB_PARTS` maps a tab to `[section id, view]` parts (a view such as `graphs`, `hardware` or `full` tells the component what to draw), `overviewParts` adds the pinned sections whole, and `availableTabs` hides a tab with nothing to show. `Tabs.jsx` is the accessible tab row (arrow keys, Home, End). To add a tab (Logs, Terminal): give it parts in `TAB_PARTS` and a component for the view. To add a section: one entry in `meta.js`, one component, one line in `index.js`.
- **One settings store** (`app/src/store.js`). Everything the window remembers is a value under a key: `get`, `set`, `subscribe`, and the hooks `useSetting` and `usePersisted`. A key is read from `localStorage` once (guarded), kept in memory, written on change, and changes from another window arrive through the `storage` event. `{ persist: false }` keeps a value in memory only. Fold choices (`col.<id>`), section layout (`groups.<machine>`), compare, range, limits and per-machine settings all use it; fold-all and "reveal this section" are in-memory values in the same store, so there is no separate event bus left.
- **Per-machine settings** (`app/src/machineSettings.js`): `{ color, tab, pinned }` under `machine.<name>`, cleaned by `normMachine` (a CSS colour or empty, a known tab, known section ids once each). `useMachineSettings(name)` gives a card one object that keeps its identity until something changes. The tab row and the pin control on each section header write `tab` and `pinned`.

## Customize (themes, fonts, colours)

Light or dark is never stored: `baseOf` in `model.js` reads the background colour of the look that is shown (the plain Dark or Light tokens decide only when no background is set), and `data-theme` follows it. Style families (`family.js`) change shape only, never colours or glass. A theme holds everything: colours, text, shape, surfaces, graphs, layout and motion. `app/src/theme/` is the pure model: `model.js` (a look is a sparse object; the table `FIELDS` lists every setting with its check and plain value; clean, merge, flatten), `colors.js` (hex maths, WCAG contrast, and `deriveColors`: the card, borders, dim text and fills follow from the background and text colours), `css.js` (a look to custom properties and `data-*` attributes on `<html>`, the colour-blind status colours, the contrast warning), `palettes.js` (the seven built-in themes, Terminal and Blueprint among them, and the eight popular palettes), `edits.js` (an edit is stored only while it differs from the theme, so Rounded works on Terminal and "off" works on a theme that turns a switch on), `presets.js` (resolving a theme plus unsaved edits, "Custom (based on X)", migrating what an older version saved), `migrate.js` (the first Customize shape, `size` and `glass`, to today's), `files.js` (theme file export and import), `history.js` (undo and redo), `fonts.js`, `graphStyle.js` (path text for line, area, bars, step and smoothing), `useCustom.js` (settings store keys `themes`, `themeId`, `edits`; writes the result once to `<html>`, so nothing re-renders per poll and `colors.js` picks the colours up). `useLook` owns it. `app/src/customize/` is the panel: docked on the right (`html[data-panel]` shrinks `#root`), one scroll of sections, a sticky header with search, jump chips, undo, redo and hold-to-compare. Style and surface effects are static CSS driven by `<html>` attributes and variables (`styles/lookfx.css`, `styles/stylefx.css`): `--rk` scales every corner radius, `--shadow-k` the shadows, `--grain`, `--bg-image`, `--glass-tint`. `theme/os.js` reads the system accent (`AccentColor`) and scales background pictures. A machine's colour is the existing `machine.<name>` setting, now chosen in the machine's ⋯ menu; cards and tiles read it as `--mc` (`theme/tint.js`). A test keeps the built-in colour table equal to `tokens.css`.

## Motion and loading

`app/src/motion.js` holds the one duration (`MOTION_MS`, 180 ms, matching `--dur`) and the reduced-motion check. `Collapse.jsx` folds its children with height and opacity (a CSS grid row from `0fr` to `1fr`) and removes them from the page once closed; machine cards, section groups and small sections use it. `LoadBar.jsx` is the thin bar at the top, on while the first state or a history or compare fetch is loading (`loading` from `useCollectorData`); graph panels show a shimmer until their machine's history arrives. Every animation is switched off under `prefers-reduced-motion`.
