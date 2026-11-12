# Releasing

The installer comes from `cargo tauri build` (targets: NSIS and MSI, see `src-tauri/tauri.conf.json`). Updates reach installed apps through GitHub Releases.

## Update signing

The updater only installs files signed with your key. The public half goes in the repo; the private half never does.

1. Make a key pair once, on your own machine: `cargo tauri signer generate -w ~/.tauri/xsm.key`. Keep the private file and its password somewhere safe (a password manager). Never commit either.
2. Put the **public** key (the text of `xsm.key.pub`) into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. It currently holds the placeholder `REPLACE_WITH_PUBLIC_KEY_SEE_docs/releasing.md`; until it is replaced, update checks answer "could not check" and installs fail safely.
3. In the GitHub repository settings add two secrets for the release workflow: `TAURI_SIGNING_PRIVATE_KEY` (the private key text) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
4. Push a tag (see "Cutting a release"). The workflow builds the signed update files only when `TAURI_SIGNING_PRIVATE_KEY` is set. Without the secret it still builds both installers, logs a warning, and skips the `.sig` files and `latest.json`, so installed apps cannot update from that release.

## Cutting a release

The version lives in one place: `version` under `[workspace.package]` in `Cargo.toml`. `src-tauri/tauri.conf.json` omits `version`, so Tauri reads it from Cargo, and a wall (`one_version_number` in `crates/xsm-walls/tests/repo.rs`) fails when `app/package.json` disagrees.

1. Raise the version in `Cargo.toml` and `app/package.json`, move the `[Unreleased]` notes in `CHANGELOG.md` under the new version, and merge to `main`.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
   Or, without a tag: Actions > Release > Run workflow on `main`. The draft then carries the tag `v<version>`, which GitHub creates when you publish it.
   The draft also gets a portable zip: the program plus `portable.txt`, which keeps settings and history in a `data` folder next to it and turns off in-app updates.
3. `.github/workflows/release.yml` (windows-latest) checks the tag matches the version, builds the window, then runs `tauri-apps/tauri-action`. It creates a **draft** release named "Xero Systems Monitor v0.2.0" with the NSIS `.exe`, the MSI and, when signing is on, the `.sig` files and `latest.json`.
4. Install the draft's `.exe` on a clean Windows PC, then press Publish on the release. The updater reads `latest.json` from the latest published release only.

## Windows code signing (planned)

Installers are not signed yet, so SmartScreen says "unknown publisher" on first run. The plan is to apply to SignPath Foundation (free code signing for open-source projects) once there is a first public release, then add a signing step to `release.yml` before the upload. Until then the README tells users what the warning means.

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
