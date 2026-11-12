//! `NET iface ip speed_mbps rx_bytes tx_bytes uptime_s`.

use crate::reading::{NetReading, Reading};

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let [_, ip, speed, rx, tx, uptime] = rest.split_whitespace().collect::<Vec<_>>()[..] else {
        return None;
    };
    r.net = Some(NetReading {
        ip: (ip != "-").then(|| ip.to_owned()),
        link_speed_mbps: speed.parse().ok(),
        rx_bytes: rx.parse().ok()?,
        tx_bytes: tx.parse().ok()?,
        uptime_s: uptime.parse().ok()?,
        ..NetReading::default()
    });
    Some(())
}

/// Bytes per second between two frames, timed by the machine's own uptime. A counter that went back gives no rate.
pub(super) fn rate(now: &mut NetReading, before: &NetReading) {
    let seconds = now.uptime_s - before.uptime_s;
    if seconds > 0.0 && now.rx_bytes >= before.rx_bytes {
        now.down_bytes_per_s = Some((now.rx_bytes - before.rx_bytes) / seconds);
        now.up_bytes_per_s = Some((now.tx_bytes - before.tx_bytes) / seconds);
    }
}
