//! Drive speed, drive health and biggest-folder text.

use xsm_core::drives::{biggest, parse_du, parse_health, parse_io, path_ok, Folder, TOP_FOLDERS};
use xsm_core::parse::parse_frame;
use xsm_core::reading::Reading;
use xsm_core::series::extra_series;

#[test]
fn speed_lines_are_read_and_bad_ones_skipped() {
    let io = parse_io("sda 1500 250.5").unwrap();
    assert_eq!(
        (io.name.as_str(), io.read_bytes_per_s, io.write_bytes_per_s),
        ("sda", 1500.0, 250.5)
    );
    assert!(parse_io("sda 1").is_none());
    assert!(parse_io("sda x 1").is_none());
    assert!(parse_io("sda 1 y").is_none());
}

#[test]
fn health_lines_keep_unknown_numbers_unknown() {
    let h = parse_health("0|Example SSD 1TB|ok|34|1200|3").unwrap();
    assert!(h.ok && h.model == "Example_SSD_1TB");
    assert_eq!(
        (h.temp_c, h.power_on_hours, h.wear_pct),
        (Some(34.0), Some(1200), Some(3.0))
    );
    let w = parse_health("sdb|Example HDD|warning|||").unwrap();
    assert!(!w.ok);
    assert_eq!((w.temp_c, w.power_on_hours, w.wear_pct), (None, None, None));
    assert!(parse_health("only|three|fields").is_none());
    assert!(parse_health("|m|ok|1|2|3").is_none());
}

#[test]
fn frame_carries_speed_health_and_the_note_forward() {
    let text = "DISKIO sda 10 20\nDISKIO nvme0n1 30 40\nSMART sda|Example SSD|ok|30|10|1\nSMART junk\nDISKIO bad\n";
    let r = parse_frame(text, None);
    assert_eq!(r.disk_io.len(), 2);
    assert_eq!(r.drive_health.len(), 1);
    let next = parse_frame("DISKIO sda 1 2\n", Some(&r));
    assert_eq!(
        next.drive_health, r.drive_health,
        "health is read rarely, so it is kept"
    );
    let denied = parse_frame("SMARTNOTE denied\n", None);
    assert_eq!(denied.health_note.as_deref(), Some("denied"));
    let kept = parse_frame("DISKIO sda 1 2\n", Some(&denied));
    assert_eq!(kept.health_note.as_deref(), Some("denied"));
    let fresh = parse_frame("SMART sda|m|ok|||\n", Some(&denied));
    assert_eq!(fresh.health_note, None);
}

#[test]
fn history_keys_name_the_drive() {
    let r = parse_frame("DISKIO sda 10 20\n", None);
    assert_eq!(
        extra_series(&r),
        vec![("dr:sda".to_owned(), 10.0), ("dw:sda".to_owned(), 20.0)]
    );
    assert!(extra_series(&Reading::default()).is_empty());
}

#[test]
fn du_lists_the_biggest_folders_without_the_root() {
    let text = "100\t/data/a\n5\t/data/b\n300\t/data\nnot a row\nx\t/data/c\n100\t/data/0\n";
    let got = parse_du(text, "/data");
    assert_eq!(
        got.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(),
        ["/data/0", "/data/a", "/data/b"]
    );
    assert_eq!(got[1].bytes, 100 * 1024);
}

#[test]
fn only_the_top_folders_are_kept() {
    let all: Vec<Folder> = (0..40u64)
        .map(|i| Folder {
            path: format!("/f{i}"),
            bytes: i,
        })
        .collect();
    let top = biggest(all);
    assert_eq!(top.len(), TOP_FOLDERS);
    assert_eq!(top[0].bytes, 39);
}

#[test]
fn paths_that_could_be_options_or_break_lines_are_refused() {
    assert!(path_ok("/var/log") && path_ok("D:\\"));
    assert!(!path_ok("") && !path_ok("  ") && !path_ok("-rf") && !path_ok("a\nb"));
}

#[test]
fn the_window_sees_speed_and_health_under_short_keys() {
    use serde_json::json;
    use xsm_core::tracker::{Rules, Tracker};
    let mut t = Tracker::new(
        "example-server",
        Rules {
            offline_after_misses: 3,
            has_runners: false,
        },
    );
    let text = "DISKIO sda 1000 500\nSMART sda|Example SSD|ok|35||\nSMARTNOTE denied\n";
    t.observe(parse_frame(text, None), 1000);
    let d = serde_json::to_value(t.snapshot()).unwrap()["d"].clone();
    assert_eq!(d["io"], json!([["sda", 1000.0, 500.0]]));
    assert_eq!(
        d["smart"],
        json!([["sda", "Example_SSD", true, 35.0, null, null]])
    );
    assert_eq!(d["smart_note"], "denied");
}
