//! Network facts beyond the byte counters: adapters, Wi-Fi, the internet check and pings to other machines.

use serde::{Deserialize, Serialize};

/// Address the internet check uses until the person picks another (it answers an empty 204).
pub const DEFAULT_CHECK_URL: &str = "https://www.gstatic.com/generate_204";
/// Seconds-to-milliseconds scale (`curl` times are in seconds).
const MS_PER_S: f64 = 1000.0;
/// First HTTP status that is not a success or a redirect.
const FIRST_ERROR_STATUS: u32 = 400;
/// Lowest HTTP status that counts as an answer at all.
const FIRST_STATUS: u32 = 200;

/// One network adapter.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Adapter {
    /// Adapter name.
    pub name: String,
    /// True when the link is up.
    pub up: bool,
    /// Link speed, megabits per second, when the driver says.
    pub speed_mbps: Option<u64>,
    /// First IPv4 address; shown in the window only.
    pub ip: Option<String>,
}

/// The Wi-Fi network this PC is on.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Wifi {
    /// Network name.
    pub name: String,
    /// Signal strength, percent.
    pub signal_pct: u32,
}

/// Result of the internet check: a DNS lookup and an HTTPS HEAD request.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Internet {
    /// True when the request got an answer.
    pub up: bool,
    /// Time for the DNS lookup, milliseconds.
    pub dns_ms: Option<f64>,
    /// Time for the whole request, milliseconds.
    pub latency_ms: Option<f64>,
}

/// One ping from this PC to another machine.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PingResult {
    /// Machine name.
    pub machine: String,
    /// Round trip, milliseconds; `None` when it did not answer.
    pub ms: Option<f64>,
}

/// `name|state|speed_mbps|ip` where state `up` (any case) is up and an empty or `-` field is unknown.
#[must_use]
pub fn parse_adapter(rest: &str) -> Option<Adapter> {
    let f: Vec<&str> = rest.trim().split('|').map(str::trim).collect();
    let [name, state, speed, ip] = f[..] else {
        return None;
    };
    (!name.is_empty()).then(|| Adapter {
        name: name.to_owned(),
        up: state.eq_ignore_ascii_case("up"),
        speed_mbps: speed.parse().ok().filter(|s| *s > 0),
        ip: (!ip.is_empty() && ip != "-").then(|| ip.to_owned()),
    })
}

/// The value after the first colon of the first line that starts with `key` (`netsh wlan show interfaces` text).
fn netsh_value<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    text.lines().find_map(|l| {
        let (k, v) = l.split_once(':')?;
        (k.trim() == key).then(|| v.trim())
    })
}

/// The connected Wi-Fi network from `netsh wlan show interfaces`; `None` when not connected.
#[must_use]
pub fn parse_netsh(text: &str) -> Option<Wifi> {
    let name = netsh_value(text, "SSID").filter(|n| !n.is_empty())?;
    let signal = netsh_value(text, "Signal")?.trim_end_matches('%').trim();
    Some(Wifi {
        name: name.to_owned(),
        signal_pct: signal.parse().ok()?,
    })
}

/// `curl -w "%{http_code} %{time_namelookup} %{time_total}"` output as an internet check result.
#[must_use]
pub fn parse_curl(text: &str) -> Internet {
    let w: Vec<&str> = text.split_whitespace().collect();
    let [code, dns, total] = w[..] else {
        return Internet::default();
    };
    let status: u32 = code.parse().unwrap_or(0);
    let ms = |s: &str| s.parse::<f64>().ok().map(|v| v * MS_PER_S);
    Internet {
        up: (FIRST_STATUS..FIRST_ERROR_STATUS).contains(&status),
        dns_ms: ms(dns),
        latency_ms: ms(total),
    }
}

/// The address to check: the one given when it is a plain `https://` address, else the default.
#[must_use]
pub fn clean_url(url: &str) -> String {
    let u = url.trim();
    let plain = u.starts_with("https://") && !u.contains(char::is_whitespace) && !u.contains('"');
    if plain {
        u.to_owned()
    } else {
        DEFAULT_CHECK_URL.to_owned()
    }
}

/// A host that is safe to hand to `ping`: not empty, not an option, no spaces; a `user@` start is dropped.
#[must_use]
pub fn ping_host(host: &str) -> Option<String> {
    let h = host.rsplit('@').next().unwrap_or("").trim();
    (!h.is_empty() && !h.starts_with('-') && !h.contains(char::is_whitespace)).then(|| h.to_owned())
}
