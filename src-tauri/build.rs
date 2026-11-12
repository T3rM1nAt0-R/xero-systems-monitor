//! Stamps the build date into the binary (for `get_version`) and runs the Tauri build step.

use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    println!("cargo:rustc-env=XSM_BUILD_DATE={seconds}");
    tauri_build::build();
}
