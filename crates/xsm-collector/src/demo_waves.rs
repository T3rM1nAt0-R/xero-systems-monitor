//! The waves the demo backend draws its numbers and series from.

use crate::history::{History, Series};
use crate::machines::{MachineConfig, MachineKind};
use std::collections::BTreeMap;
use std::f64::consts::TAU;
use xsm_core::series::{READ_PREFIX, WRITE_PREFIX};

const SERIES_POINTS: f64 = 400.0;
const MIN_STEP_S: f64 = 3.0;

/// `(base, swing, period in seconds)` of a wave.
pub(crate) type Wave = (f64, f64, f64);
pub(crate) const CPU: Wave = (18.0, 40.0, 900.0);
pub(crate) const RAM: Wave = (48.0, 12.0, 5400.0);
pub(crate) const TEMP: Wave = (46.0, 18.0, 900.0);
pub(crate) const GPU: Wave = (8.0, 45.0, 1300.0);
pub(crate) const GTEMP: Wave = (40.0, 22.0, 1300.0);
pub(crate) const VRAM: Wave = (25.0, 20.0, 3000.0);
pub(crate) const DOWN: Wave = (2e5, 3e6, 700.0);
pub(crate) const UP: Wave = (5e4, 6e5, 500.0);
pub(crate) const PING: Wave = (12.0, 8.0, 300.0);

pub(crate) fn wave((base, swing, period): Wave, phase: f64, t: f64) -> f64 {
    base + swing * (0.5 + 0.5 * (t / period * TAU + phase).sin())
}

/// A different phase for every machine name.
pub(crate) fn phase_of(name: &str) -> f64 {
    name.bytes()
        .fold(7.0, |a, b| (a * 31.0 + f64::from(b)) % 1000.0)
}

/// The series of one machine, `None` for a metric it lacks.
pub(crate) fn series(m: &MachineConfig, wave_of: Wave, now: f64, range: f64) -> Series {
    let step = MIN_STEP_S.max((range / SERIES_POINTS).floor());
    let phase = phase_of(&m.name);
    let mut out = Vec::new();
    let mut t = now - range;
    while t <= now {
        out.push((t.round(), wave(wave_of, phase, t)));
        t += step;
    }
    out
}

pub(crate) fn history(m: &MachineConfig, now: f64, range: f64) -> History {
    let s = |w| series(m, w, now, range);
    let gpu = |w| if is_pc(m) { s(w) } else { Vec::new() };
    let drive = if is_pc(m) { "C:" } else { "/" };
    let flat = |v: f64| s((v, 0.0, 1.0));
    History {
        cpu: s(CPU),
        ram: s(RAM),
        disk: flat(62.0),
        temp: s(TEMP),
        gpu: gpu(GPU),
        vram: gpu(VRAM),
        gtemp: gpu(GTEMP),
        down: s(DOWN),
        up: s(UP),
        ping: s(PING),
        loss: Some(0.0),
        extra: BTreeMap::from([
            (format!("{READ_PREFIX}{drive}"), s(DOWN)),
            (format!("{WRITE_PREFIX}{drive}"), s(UP)),
        ]),
    }
}

fn is_pc(m: &MachineConfig) -> bool {
    m.kind == MachineKind::Local
}
