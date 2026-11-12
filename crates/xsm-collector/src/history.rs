//! The series the charts draw.

use serde::Serialize;

/// One series: `[unix seconds, value]` pairs, oldest first.
pub type Series = Vec<(f64, f64)>;

/// Up to about 400 points per series; a series the machine lacks is empty.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct History {
    /// CPU, percent.
    pub cpu: Series,
    /// Memory, percent.
    pub ram: Series,
    /// Disk, percent.
    pub disk: Series,
    /// CPU temperature, degrees Celsius.
    pub temp: Series,
    /// GPU, percent.
    pub gpu: Series,
    /// Video memory, percent.
    pub vram: Series,
    /// GPU temperature, degrees Celsius.
    pub gtemp: Series,
    /// Download, bytes per second.
    pub down: Series,
    /// Upload, bytes per second.
    pub up: Series,
    /// Ping, milliseconds.
    pub ping: Series,
    /// Share of pings lost, percent.
    pub loss: Option<f64>,
}

/// The answer of `get_history`: the series, or `{}` for a machine nobody knows.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum HistoryReply {
    /// A known machine.
    Known(Box<History>),
    /// An unknown machine.
    Unknown {},
}

impl From<xsm_store::History> for History {
    /// The one place the store's history becomes the window's `[t, value][]` series.
    fn from(h: xsm_store::History) -> Self {
        Self {
            cpu: h.cpu,
            ram: h.ram,
            disk: h.disk,
            temp: h.temp,
            gpu: h.gpu,
            vram: h.vram,
            gtemp: h.gtemp,
            down: h.down,
            up: h.up,
            ping: h.ping,
            loss: h.loss,
        }
    }
}
