//! The desktop app starts here; everything else is in the library.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    xero_systems_monitor::run();
}
