//! `LibreHardwareMonitor` web JSON (`/data.json`) in, extra hardware numbers out. Pure text parsing.

use crate::reading::SensorDetail;
use serde_json::Value;

/// Icon name part that marks a processor.
const CPU_ICON: &str = "cpu";
/// Icon name parts that mark a graphics card.
const GPU_ICONS: [&str; 2] = ["nvidia", "ati"];
/// Category node holding fan speeds.
const FANS: &str = "Fans";
/// Category node holding clock speeds.
const CLOCKS: &str = "Clocks";
/// Category node holding power draw.
const POWERS: &str = "Powers";
/// Category node holding load percentages.
const LOAD: &str = "Load";
/// Sensor name part (lower case) of one processor core in the load and clock lists.
const CORE: &str = "core #";
/// Sensor names (lower case) that hold the package power of a processor.
const CPU_PACKAGE: [&str; 2] = ["cpu package", "package"];

/// The number at the start of a value such as `"3600,0 MHz"` (comma or dot decimals).
fn number_of(value: &str) -> Option<f64> {
    let value = value.trim();
    let num = value.split_once(' ').map_or(value, |(n, _)| n);
    num.replace(',', ".").parse().ok()
}

/// Text field of a node, empty when missing.
fn text<'a>(node: &'a Value, key: &str) -> &'a str {
    node.get(key).and_then(Value::as_str).unwrap_or("")
}

/// Child nodes of a node.
fn kids(node: &Value) -> &[Value] {
    node.get("Children")
        .and_then(Value::as_array)
        .map_or(&[], Vec::as_slice)
}

/// Every `(sensor name, number)` under the category `category` of a hardware node.
fn sensors<'a>(hardware: &'a Value, category: &str) -> Vec<(&'a str, f64)> {
    kids(hardware)
        .iter()
        .filter(|c| text(c, "Text") == category)
        .flat_map(kids)
        .filter_map(|s| Some((text(s, "Text"), number_of(text(s, "Value"))?)))
        .collect()
}

/// The numbers of the sensors whose name holds a core mark, in file order.
fn cores(hardware: &Value, category: &str) -> Vec<f64> {
    sensors(hardware, category)
        .into_iter()
        .filter(|(n, _)| n.to_lowercase().contains(CORE))
        .map(|(_, v)| v)
        .collect()
}

/// Average of a list, `None` when it is empty.
fn average(list: &[f64]) -> Option<f64> {
    let n = f64::from(u32::try_from(list.len()).unwrap_or(u32::MAX));
    (!list.is_empty()).then(|| list.iter().sum::<f64>() / n)
}

/// Add one node (and the hardware nested below it) to `out`.
fn collect(node: &Value, out: &mut SensorDetail) {
    let icon = text(node, "ImageURL").to_lowercase();
    out.fans_rpm
        .extend(sensors(node, FANS).into_iter().map(|(_, rpm)| rpm));
    if icon.contains(CPU_ICON) {
        out.cpu_clock_mhz = average(&cores(node, CLOCKS));
        out.cpu_power_w = sensors(node, POWERS)
            .into_iter()
            .find(|(n, _)| CPU_PACKAGE.contains(&n.to_lowercase().as_str()))
            .map(|(_, w)| w);
        out.core_load_pct = cores(node, LOAD);
    } else if GPU_ICONS.iter().any(|g| icon.contains(g)) {
        out.gpu_power_w = sensors(node, POWERS).first().map(|(_, w)| *w);
    }
    for child in kids(node) {
        collect(child, out);
    }
}

/// Fans, CPU clock, CPU and GPU power and per-core load from `LibreHardwareMonitor`'s JSON text.
/// `None` when the text is not JSON or holds none of them.
#[must_use]
pub fn parse_lhm(json: &str) -> Option<SensorDetail> {
    let root = serde_json::from_str::<Value>(json).ok()?;
    let mut out = SensorDetail::default();
    collect(&root, &mut out);
    (out != SensorDetail::default()).then_some(out)
}
