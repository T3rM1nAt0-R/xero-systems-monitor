# Rules for anyone (person or AI) writing code here

Read `docs/architecture.md` (the block map) first. Each block has one job and uses only what its row allows.

## The one check

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace          # includes the walls
cd app && npm ci && npm test && npm run lint
```

CI runs exactly this on Windows and Linux for every pull request and every push to `main`.

## House rules (each is a wall in `crates/xsm-walls`, each wall proven on a bad sample)

- **Small files:** no source file over 400 lines (Rust, JS, JSX, sh). Split before the wall.
- **Small PRs:** one PR closes one issue; at most 1,200 added lines of code, at most 400 in the pure blocks.
- **Block map:** each crate depends only on what `docs/architecture.md` allows.
- **Pure blocks stay pure:** `xsm-core` and `xsm-settings` never use `std::fs`, `std::net`, `std::process`, `std::thread`, `std::time::SystemTime`/`Instant`, or `rand`. Time comes in as an argument.
- **Front doors:** the public items of each crate are listed in `walls/front-doors.txt`. Making something new public adds a line, so a growing API shows in review.
- **No bare numbers in pure blocks:** every number other than 0 and 1 is a named `const`.
- **Settings in files:** tunables (poll interval, limits, retention, alert thresholds) live in `settings/*.json` as named whole numbers, read through `xsm-settings`. A new tunable is a new key, never a hard-coded value.
- **One home per job:** see `walls/one-home.txt`.
- **No pasted copies:** the same run of about 100 tokens may appear only once (DRY). Shared code goes into one function in one block.
- **Docs on everything public:** `#![deny(missing_docs)]` in every crate.
- **No escape hatches:** no `#[allow(...)]` without a reason comment on the line above, no `unsafe` outside `xsm-sources` Windows code, no `unwrap()`/`expect()` outside tests.
- **No personal data:** no private IPs (use `192.0.2.x`), no real host or user names, no `C:\Users\...` paths, no secrets. Test fixtures use `example-server`, `user`.
- **Tests:** every parser and detector has tests with fixtures in `tests/fixtures/`. Coverage of the pure blocks stays at 100% lines (`cargo llvm-cov`, nightly).

## Words

Plain names, not codenames. If a name needs explaining, rename it.
