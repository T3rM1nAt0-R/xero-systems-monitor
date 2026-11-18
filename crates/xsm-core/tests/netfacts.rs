//! Adapters, Wi-Fi, the internet check and pings.

use serde_json::json;
use xsm_core::netfacts::{
    clean_url, parse_adapter, parse_curl, parse_netsh, ping_host, Internet, PingResult,
    DEFAULT_CHECK_URL,
};
use xsm_core::parse::parse_frame;
use xsm_core::reading::Reading;
use xsm_core::series::extra_series;
use xsm_core::tracker::{Rules, Tracker};

const NETSH: &str = "    Name                   : Wi-Fi\n    SSID                   : Example Net\n    BSSID                  : 00:00:00:00:00:00\n    Signal                 : 87%\n";

#[test]
fn adapters_are_read_and_bad_rows_skipped() {
    let a = parse_adapter("Ethernet|Up|1000|192.0.2.20").unwrap();
    assert!(a.up && a.speed_mbps == Some(1000) && a.ip.as_deref() == Some("192.0.2.20"));
    let b = parse_adapter("Wi-Fi|Disconnected|0|-").unwrap();
    assert!(!b.up && b.speed_mbps.is_none() && b.ip.is_none());
    let c = parse_adapter("eth1|up||").unwrap();
    assert!(c.speed_mbps.is_none() && c.ip.is_none());
    assert!(parse_adapter("a|b|c").is_none());
    assert!(parse_adapter("|up|1|x").is_none());
}

#[test]
fn wifi_comes_from_netsh() {
    let w = parse_netsh(NETSH).unwrap();
    assert_eq!((w.name.as_str(), w.signal_pct), ("Example Net", 87));
    assert!(parse_netsh("    State : disconnected\n").is_none());
    assert!(parse_netsh("    SSID : \n    Signal : 5%\n").is_none());
    assert!(parse_netsh("    SSID : X\n").is_none());
    assert!(parse_netsh("    SSID : X\n    Signal : lots\n").is_none());
}

#[test]
fn internet_check_reads_curl_times() {
    let i = parse_curl("204 0.012 0.045");
    assert!(i.up);
    assert!((i.dns_ms.unwrap() - 12.0).abs() < 1e-6 && (i.latency_ms.unwrap() - 45.0).abs() < 1e-6);
    assert!(!parse_curl("503 0.01 0.02").up);
    assert!(!parse_curl("000 0.000 0.000").up);
    assert_eq!(parse_curl(""), Internet::default());
    assert!(parse_curl("204 x y").dns_ms.is_none());
}

#[test]
fn only_plain_https_addresses_are_used() {
    assert_eq!(
        clean_url(" https://example.com/ok "),
        "https://example.com/ok"
    );
    for bad in [
        "http://example.com",
        "",
        "https://a b",
        "https://a\"b",
        "ftp://x",
    ] {
        assert_eq!(clean_url(bad), DEFAULT_CHECK_URL);
    }
}

#[test]
fn ping_hosts_cannot_be_options() {
    assert_eq!(ping_host("user@192.0.2.10").as_deref(), Some("192.0.2.10"));
    assert_eq!(
        ping_host("example-server").as_deref(),
        Some("example-server")
    );
    assert!(ping_host("-f").is_none() && ping_host("").is_none() && ping_host("a b").is_none());
}

#[test]
fn adapters_are_kept_between_frames_and_series_are_named() {
    let first = parse_frame("ADAPTER eth0|up|1000|192.0.2.10\nADAPTER junk\n", None);
    assert_eq!(first.adapters.len(), 1);
    let next = parse_frame("DISKIO sda 1 2\n", Some(&first));
    assert_eq!(next.adapters, first.adapters);
    let r = Reading {
        internet: Some(Internet {
            up: true,
            dns_ms: Some(1.0),
            latency_ms: Some(40.0),
        }),
        pings: vec![
            PingResult {
                machine: "example-server".into(),
                ms: Some(3.0),
            },
            PingResult {
                machine: "lost".into(),
                ms: None,
            },
        ],
        ..Reading::default()
    };
    let keys: Vec<_> = extra_series(&r).into_iter().map(|s| s.0).collect();
    assert_eq!(keys, ["inet", "inet_ms", "pm:example-server"]);
    let down = Reading {
        internet: Some(Internet::default()),
        ..Reading::default()
    };
    assert_eq!(extra_series(&down), vec![("inet".to_owned(), 0.0)]);
}

#[test]
fn the_window_sees_adapters_wifi_internet_and_pings() {
    let mut t = Tracker::new(
        "This PC",
        Rules {
            offline_after_misses: 3,
            has_runners: false,
        },
    );
    let mut r = parse_frame("ADAPTER Ethernet|up|1000|192.0.2.20\n", None);
    r.wifi = parse_netsh(NETSH);
    r.internet = Some(parse_curl("204 0.01 0.05"));
    r.pings = vec![PingResult {
        machine: "example-server".into(),
        ms: None,
    }];
    t.observe(r, 1000);
    let d = serde_json::to_value(t.snapshot()).unwrap()["d"].clone();
    assert_eq!(
        d["adapters"],
        json!([["Ethernet", true, 1000, "192.0.2.20"]])
    );
    assert_eq!(d["wifi"], json!(["Example Net", 87]));
    assert_eq!(d["inet"], json!([true, 10.0, 50.0]));
    assert_eq!(d["pings"], json!([["example-server", null]]));
}
