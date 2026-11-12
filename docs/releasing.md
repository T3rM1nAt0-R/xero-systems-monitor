# Releasing

The installer comes from `cargo tauri build` (targets: NSIS and MSI, see `src-tauri/tauri.conf.json`). Updates reach installed apps through GitHub Releases.

## Update signing

The updater only installs files signed with your key. The public half goes in the repo; the private half never does.

1. Make a key pair once, on your own machine: `cargo tauri signer generate -w ~/.tauri/xsm.key`. Keep the private file and its password somewhere safe (a password manager). Never commit either.
2. Put the **public** key (the text of `xsm.key.pub`) into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. It currently holds the placeholder `REPLACE_WITH_PUBLIC_KEY_SEE_docs/releasing.md`; until it is replaced, update checks answer "could not check" and installs fail safely.
3. In the GitHub repository settings add two secrets for the release workflow: `TAURI_SIGNING_PRIVATE_KEY` (the private key text) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
4. Build the release with signed update files: `cargo tauri build --config '{"bundle":{"createUpdaterArtifacts":true}}'`. This writes the installers plus `.sig` files.
5. Publish a GitHub Release with the installers, their `.sig` files and a `latest.json` (the `tauri-action` GitHub Action writes it). The app reads `https://github.com/T3rM1nAt0-R/xero-systems-monitor/releases/latest/download/latest.json`.

## What the window sees

`check_for_updates` and `apply_update` use the updater plugin and answer the window's contract like this:

| Command | Outcome | Answer |
| --- | --- | --- |
| `check_for_updates` | a newer version is in `latest.json` | `true` |
| `check_for_updates` | the version is current | `false` |
| `check_for_updates` | no network, no release, unreadable `latest.json` | `null` |
| `apply_update` | downloaded, signature good, installed | `true` (the window offers a restart) |
| `apply_update` | any failure (no update, bad signature, download error) | `false` |

`"dirty"` is never sent: it belonged to the old git-based updater, which refused to overwrite local edits. An installed app has no working copy to protect.

## Icons

`src-tauri/icons/` holds a bar-chart icon drawn from three rounded bars on a dark square (a 512 px `icon.png`, the sizes Tauri lists, and a multi-size `icon.ico`). To change it, replace `icon.png` with a square image of at least 512 px and run `cargo tauri icon src-tauri/icons/icon.png`, which writes the full set for every platform.
