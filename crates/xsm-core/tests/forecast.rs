//! Disk-full forecast.

use xsm_core::forecast::forecast;

const DAY: i64 = 86_400;

fn line(days: i32, start: f64, per_day: f64) -> Vec<(i64, f64)> {
    (0..days)
        .map(|i| (i64::from(i) * DAY, start + per_day * f64::from(i)))
        .collect()
}

#[test]
fn rising_disk_says_when_it_fills() {
    let f = forecast(&line(10, 50.0, 1.0)); // +1 % a day, now 59 %
    assert_eq!(f.days, Some(41.0));
    assert_eq!(f.per_day, Some(1.0));
}

#[test]
fn flat_shrinking_or_short_history_says_nothing() {
    assert_eq!(forecast(&line(10, 50.0, 0.0)).days, None);
    assert_eq!(forecast(&line(10, 80.0, -1.0)).days, None);
    assert_eq!(forecast(&line(10, 80.0, -1.0)).per_day, Some(-1.0));
    assert_eq!(forecast(&line(2, 50.0, 1.0)).per_day, None);
    assert_eq!(forecast(&[]).per_day, None);
    let close: Vec<_> = (0..5_i32)
        .map(|i| (i64::from(i) * 100, 50.0 + f64::from(i)))
        .collect();
    assert_eq!(forecast(&close).per_day, None); // three points but under two days
}

#[test]
fn slow_fill_beyond_ten_years_has_a_slope_but_no_days() {
    let f = forecast(&line(10, 10.0, 0.021));
    assert_eq!(f.per_day, Some(0.021));
    assert_eq!(f.days, None);
}

#[test]
fn only_the_last_thirty_days_count_and_order_does_not_matter() {
    let mut p = line(29, 20.0, 0.0); // flat for a month...
    p.extend((29..60_i32).map(|i| (i64::from(i) * DAY, 20.0 + f64::from(i - 29)))); // ...then +1 a day
    p.reverse();
    let f = forecast(&p);
    assert_eq!(f.per_day, Some(1.0));
    assert_eq!(f.days, Some(50.0)); // now 50 %
}

#[test]
fn a_full_disk_is_zero_days() {
    let f = forecast(&line(5, 96.0, 1.0)); // 100 % today
    assert_eq!(f.days, Some(0.0));
    let over = forecast(&line(5, 98.0, 1.0));
    assert_eq!(over.days, Some(0.0)); // never negative
}

#[test]
fn serializes_with_nulls() {
    let j = serde_json::to_string(&forecast(&[])).unwrap();
    assert_eq!(j, r#"{"per_day":null,"days":null}"#);
}
