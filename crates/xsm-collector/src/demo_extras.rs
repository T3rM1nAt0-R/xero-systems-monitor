//! Made-up hardware extras for the demo PC: per-core temperatures, a battery and programs using the GPU.

use xsm_core::reading::{BatteryReading, GpuApp, Reading};

const MIB: u64 = 1_048_576;
const CORES: u8 = 8;

/// Add the extras to a demo reading that already has sensors; `cpu_pct` and `wave_pct` move the numbers.
pub(crate) fn pc_extras(r: &mut Reading, cpu_pct: f64, wave_pct: f64) {
    if let Some(s) = r.sensors.as_mut() {
        s.core_temp_c = (0..CORES)
            .map(|i| 45.0 + cpu_pct / 4.0 + f64::from(i))
            .collect();
    }
    r.gpu_apps = Some(vec![
        GpuApp {
            name: "game".to_owned(),
            vram_bytes: 5000 * MIB,
            processes: 1,
        },
        GpuApp {
            name: "browser".to_owned(),
            vram_bytes: 800 * MIB,
            processes: 3,
        },
    ]);
    r.battery = Some(BatteryReading {
        charge_pct: 20.0 + wave_pct / 2.0,
        plugged_in: false,
        minutes_left: Some(130),
    });
}
