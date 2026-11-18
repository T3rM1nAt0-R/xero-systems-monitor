//! `LibreHardwareMonitor` JSON tests; fixtures in `tests/fixtures/lhm/`.

use std::fs;
use std::path::Path;
use xsm_core::lhm::parse_lhm;

fn fixture(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/lhm");
    fs::read_to_string(path.join(name)).unwrap_or_else(|e| panic!("{name}: {e}"))
}

#[test]
fn full_tree() {
    let s = parse_lhm(&fixture("data.json")).expect("sensors");
    assert_eq!(s.fans_rpm, [1200.0, 850.0]); // the unreadable fan is skipped
    assert_eq!(s.cpu_clock_mhz, Some(3800.25)); // bus speed is not a core
    assert_eq!(s.cpu_power_w, Some(45.5));
    assert_eq!(s.gpu_power_w, Some(120.0));
    assert_eq!(s.core_load_pct, [10.0, 55.5]); // the total is not a core
    assert_eq!(s.core_temp_c, [51.0, 53.5]); // the distance to the limit is not a temperature
}

#[test]
fn partial_tree() {
    let s = parse_lhm(&fixture("gpu_only.json")).expect("sensors");
    assert_eq!(s.gpu_power_w, Some(30.5));
    assert_eq!(s.cpu_power_w, Some(12.0));
    assert_eq!(s.cpu_clock_mhz, None);
    assert!(s.fans_rpm.is_empty() && s.core_load_pct.is_empty());
}

#[test]
fn nothing_useful_is_none() {
    assert_eq!(parse_lhm(&fixture("nothing.json")), None);
    assert_eq!(parse_lhm("not json"), None);
    assert_eq!(parse_lhm(r#"{"Children":"x"}"#), None);
}
