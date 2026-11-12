//! When will the disk be full? A straight line through the last 30 days of disk use.

use serde::Serialize;

/// Seconds in a day.
const DAY_S: i64 = 86_400;
/// Seconds in a day, as a fraction base.
const DAY_SECONDS: f64 = 86_400.0;
/// Only points this many days before the newest one are fitted.
const FIT_DAYS: i64 = 30;
/// Fewest points a line needs.
const MIN_POINTS: usize = 3;
/// The points must span at least this many days.
const MIN_SPAN_DAYS: i64 = 2;
/// A slope below this, percent per day, counts as not filling up.
const FLAT_PER_DAY: f64 = 0.02;
/// A disk that would take this many days or more to fill is not worth a number.
const MAX_DAYS: f64 = 3650.0;
/// Exponent of a squared distance.
const SQUARE: i32 = 2;
/// A full disk, percent.
const FULL_PCT: f64 = 100.0;
/// Slopes are shown to this many steps per percent (three decimals).
const SLOPE_STEPS: f64 = 1000.0;

/// How fast the disk fills and when it runs out. A field is `None` when the data
/// is too thin or the disk is not filling.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Forecast {
    /// Percent of the disk gained per day.
    pub per_day: Option<f64>,
    /// Whole days until the disk is full.
    pub days: Option<f64>,
}

const NOTHING: Forecast = Forecast {
    per_day: None,
    days: None,
};

/// Fit a line through `(unix seconds, used percent)` points, in any order, using
/// the 30 days before the newest point.
#[must_use]
pub fn forecast(points: &[(i64, f64)]) -> Forecast {
    let Some(&(newest, now_pct)) = points.iter().max_by_key(|p| p.0) else {
        return NOTHING;
    };
    let recent: Vec<(i64, f64)> = points
        .iter()
        .copied()
        .filter(|p| p.0 >= newest - FIT_DAYS * DAY_S)
        .collect();
    let oldest = recent.iter().map(|p| p.0).min().unwrap_or(newest);
    if recent.len() < MIN_POINTS || newest - oldest < MIN_SPAN_DAYS * DAY_S {
        return NOTHING;
    }
    let day = |t: i64| f64::from(i32::try_from(t - oldest).unwrap_or(i32::MAX)) / DAY_SECONDS;
    let n = f64::from(u32::try_from(recent.len()).unwrap_or(u32::MAX));
    let mean_x = recent.iter().map(|p| day(p.0)).sum::<f64>() / n;
    let mean_y = recent.iter().map(|p| p.1).sum::<f64>() / n;
    let spread: f64 = recent
        .iter()
        .map(|p| (day(p.0) - mean_x).powi(SQUARE))
        .sum();
    let slope = recent
        .iter()
        .map(|p| (day(p.0) - mean_x) * (p.1 - mean_y))
        .sum::<f64>()
        / spread;
    let per_day = Some((slope * SLOPE_STEPS).round() / SLOPE_STEPS);
    let days = ((FULL_PCT - now_pct) / slope).round().max(0.0);
    Forecast {
        per_day,
        days: (slope >= FLAT_PER_DAY && days < MAX_DAYS).then_some(days),
    }
}
