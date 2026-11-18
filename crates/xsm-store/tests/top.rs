//! The busiest programs of each minute: kept once a minute, ten at most, found by time.

// reason: the tests panic on a broken setup, which is how they fail
#![allow(clippy::unwrap_used)]

use xsm_core::reading::TopProgram;
use xsm_store::{Store, TOP_KEPT};

const T: i64 = 1_800_000_040;
const MIB: u64 = 1 << 20;

fn prog(name: &str, cpu: f64) -> TopProgram {
    TopProgram {
        name: name.into(),
        cpu_pct: cpu,
        ram_bytes: 300 * MIB,
        processes: 2,
    }
}

fn first_name(s: &Store, t: i64) -> String {
    s.busiest_at("a", t).unwrap().unwrap().programs[0]
        .name
        .clone()
}

#[test]
fn first_list_of_a_minute_wins_and_is_found_by_time() {
    let s = Store::open_in_memory().unwrap();
    s.add_top("a", T, &[prog("slow", 1.0), prog("fast", 30.0)])
        .unwrap();
    s.add_top("a", T + 10, &[prog("other", 99.0)]).unwrap();
    let minute = T.div_euclid(60) * 60;
    let got = s.busiest_at("a", T + 50).unwrap().unwrap();
    assert_eq!(got.t, minute);
    let names: Vec<_> = got.programs.iter().map(|p| p.name.as_str()).collect();
    assert_eq!(names, ["fast", "slow"]);
    assert_eq!(got.programs[0].ram_bytes, 300 * MIB);
    assert_eq!(got.programs[0].processes, 2);
}

#[test]
fn only_the_busiest_ten_are_kept() {
    let s = Store::open_in_memory().unwrap();
    let mut many: Vec<_> = (0..15)
        .map(|i| prog(&format!("p{i}"), f64::from(i)))
        .collect();
    for (i, p) in many.iter_mut().enumerate() {
        p.ram_bytes = (15 - i as u64) * MIB; // the lightest programs are the biggest
    }
    s.add_top("a", T, &many).unwrap();
    let got = s.busiest_at("a", T).unwrap().unwrap();
    assert_eq!(got.programs.len(), TOP_KEPT);
    assert_eq!(got.programs[0].name, "p14");
}

#[test]
fn nothing_is_found_far_from_a_stored_minute_or_for_another_machine() {
    let s = Store::open_in_memory().unwrap();
    assert!(s.busiest_at("a", T).unwrap().is_none());
    s.add_top("a", T, &[prog("x", 5.0)]).unwrap();
    assert!(s.busiest_at("a", T + 3600).unwrap().is_none());
    assert!(s.busiest_at("a", T - 3600).unwrap().is_none());
    assert!(s.busiest_at("b", T).unwrap().is_none());
    s.add_top("c", T, &[]).unwrap(); // an empty list stores nothing
    assert!(s.busiest_at("c", T).unwrap().is_none());
}

#[test]
fn the_nearer_of_two_minutes_is_chosen() {
    let s = Store::open_in_memory().unwrap();
    let minute = T.div_euclid(60) * 60;
    s.add_top("a", minute, &[prog("early", 5.0)]).unwrap();
    s.add_top("a", minute + 120, &[prog("late", 5.0)]).unwrap();
    assert_eq!(first_name(&s, minute + 100), "late");
    assert_eq!(first_name(&s, minute + 20), "early");
}

#[test]
fn rename_moves_them_and_prune_forgets_old_ones() {
    let s = Store::open_in_memory().unwrap();
    s.add_top("old", T, &[prog("x", 5.0)]).unwrap();
    s.rename_machine("old", "new").unwrap();
    assert!(s.busiest_at("old", T).unwrap().is_none());
    assert!(s.busiest_at("new", T).unwrap().is_some());
    s.prune(T + 2 * 86_400, 365).unwrap();
    assert!(s.busiest_at("new", T).unwrap().is_some());
    s.prune(T + 4 * 86_400, 365).unwrap();
    assert!(s.busiest_at("new", T).unwrap().is_none());
}

#[test]
fn the_top_five_by_cpu_and_the_top_five_by_memory_are_kept() {
    let s = Store::open_in_memory().unwrap();
    let mut many: Vec<_> = (0..12)
        .map(|i| prog(&format!("p{i}"), f64::from(i)))
        .collect();
    for (i, p) in many.iter_mut().enumerate() {
        p.ram_bytes = if i < 3 { 9000 * MIB } else { MIB };
    }
    s.add_top("a", T, &many).unwrap();
    let got = s.busiest_at("a", T).unwrap().unwrap();
    let names: Vec<_> = got.programs.into_iter().map(|p| p.name).collect();
    assert_eq!(names.len(), 8, "five by CPU plus three memory hogs");
    assert!(names.contains(&"p0".to_owned()) && names.contains(&"p11".to_owned()));
}

#[test]
fn a_range_is_ranked_by_average_cpu() {
    let s = Store::open_in_memory().unwrap();
    s.add_top("a", T, &[prog("steady", 10.0), prog("burst", 40.0)])
        .unwrap();
    s.add_top("a", T + 60, &[prog("steady", 10.0)]).unwrap();
    s.add_top("a", T + 7200, &[prog("late", 90.0)]).unwrap();
    let got = s.busiest_between("a", T, T + 3600).unwrap();
    assert_eq!(got.minutes, 2);
    let rows: Vec<_> = got
        .programs
        .iter()
        .map(|p| (p.name.as_str(), p.cpu_pct, p.minutes))
        .collect();
    assert_eq!(rows, [("burst", 20.0, 1), ("steady", 10.0, 2)]);
    let none = s.busiest_between("b", T, T + 3600).unwrap();
    assert_eq!((none.minutes, none.programs.len()), (0, 0));
}
