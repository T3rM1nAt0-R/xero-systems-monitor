//! Tracker: container and systemd-unit events.

use serde_json::json;
use xsm_core::reading::{ContainerState, FailedService, Reading};
use xsm_core::tracker::{Rules, Tracker};

fn tracker(runners: bool) -> Tracker {
    Tracker::new(
        "example-server",
        Rules {
            offline_after_misses: 3,
            has_runners: runners,
        },
    )
}

fn texts(ev: &[xsm_core::tracker::Event]) -> Vec<&str> {
    ev.iter().map(|e| e.text.as_str()).collect()
}

fn container(name: &str, state: &str, status: &str) -> ContainerState {
    ContainerState {
        name: name.into(),
        state: state.into(),
        status: status.into(),
        image: "img".into(),
        ..ContainerState::default()
    }
}

fn docker(list: Vec<ContainerState>) -> Reading {
    Reading {
        containers: Some(list),
        ..Reading::default()
    }
}

#[test]
fn container_events() {
    let mut t = tracker(false);
    let up = || container("web", "running", "Up 1 hour");
    assert!(t.observe(docker(vec![up()]), 0).is_empty()); // baseline
    let ev = t.observe(
        docker(vec![container(
            "web",
            "restarting",
            "Restarting (1) 3 seconds ago",
        )]),
        3,
    );
    assert_eq!(texts(&ev), ["container web is restarting"]);
    assert!(t
        .observe(docker(vec![container("web", "restarting", "x")]), 6)
        .is_empty()); // still bad: quiet
    assert_eq!(
        texts(&t.observe(docker(vec![up()]), 9)),
        ["container web is running again"]
    );
    let ev = t.observe(
        docker(vec![
            container("new", "exited", "Exited (1) 2 seconds ago"),
            up(),
        ]),
        12,
    );
    assert_eq!(texts(&ev), ["container new is exited"]);
    let ev = t.observe(
        docker(vec![
            container("new", "exited", "Exited (0) 1 minute ago"),
            up(),
        ]),
        15,
    );
    assert!(ev.is_empty()); // a clean exit is not bad, and exited is not "running again"
    let calm = t.observe(
        docker(vec![container("fine", "created", "Created"), up()]),
        18,
    );
    assert!(calm.is_empty()); // a new healthy container says nothing
}

#[test]
fn flapping_is_said_once_per_window() {
    let mut t = tracker(false);
    let states = [
        "running", "exited", "running", "exited", "running", "exited", "running",
    ];
    let mut said = Vec::new();
    for (i, s) in states.iter().enumerate() {
        let line = if *s == "running" {
            "Up 1 second"
        } else {
            "Exited (0) 1 second ago"
        };
        let now = i64::try_from(i).unwrap() * 10;
        said.extend(
            t.observe(docker(vec![container("web", s, line)]), now)
                .into_iter()
                .map(|e| e.text),
        );
    }
    let flaps: Vec<_> = said
        .iter()
        .filter(|s| s.contains("keeps restarting"))
        .collect();
    assert_eq!(
        flaps,
        ["container web keeps restarting (4 state changes in 30 min)"]
    );
    // far later, it starts again
    t.observe(
        docker(vec![container("web", "exited", "Exited (0) 1 s")]),
        5000,
    );
    let mut later = Vec::new();
    for (i, s) in ["running", "exited", "running", "exited"]
        .iter()
        .enumerate()
    {
        later.extend(t.observe(
            docker(vec![container("web", s, "x")]),
            5010 + i64::try_from(i).unwrap() * 10,
        ));
    }
    assert!(later.iter().any(|e| e.text.contains("keeps restarting")));
}

#[test]
fn disappeared_containers_stay_a_day() {
    let mut t = tracker(false);
    let keep = container("db", "running", "Up 5 hours");
    t.observe(
        docker(vec![
            keep.clone(),
            container("a1b2c3d4e5f6a7", "running", "Up"),
        ]),
        0,
    );
    t.observe(
        docker(vec![
            keep.clone(),
            container("a1b2c3d4e5f6a7b8c9d0_x", "running", "Up"),
        ]),
        1,
    );
    t.observe(
        docker(vec![keep.clone(), container("tmp", "running", "Up")]),
        2,
    );
    t.observe(
        docker(vec![keep.clone(), container("tmp", "running", "Up")]),
        100,
    );
    let ev = t.observe(docker(vec![keep.clone()]), 200);
    assert_eq!(texts(&ev), ["container tmp disappeared (was Up)"]);
    let snap = t.snapshot();
    assert_eq!(snap.cgone.len(), 1); // the hash-named ones do not count, "tmp" was seen for a minute
    assert_eq!(
        serde_json::to_value(&snap).unwrap()["cgone"],
        json!([["tmp", 200, "running", "Up", "img"]])
    );
    t.observe(docker(vec![keep.clone()]), 200 + 86_400);
    assert_eq!(t.snapshot().cgone.len(), 1);
    t.observe(docker(vec![keep.clone()]), 201 + 86_400);
    assert!(t.snapshot().cgone.is_empty());
}

#[test]
fn a_gone_container_coming_back_is_said() {
    let mut t = tracker(false);
    let web = container("web", "running", "Up");
    t.observe(docker(vec![web.clone()]), 0);
    t.observe(docker(vec![]), 100);
    assert_eq!(
        texts(&t.observe(docker(vec![web]), 110)),
        ["container web is back (running)"]
    );
    assert!(t.snapshot().cgone.is_empty());
}

#[test]
fn at_most_twenty_gone_containers() {
    let mut t = tracker(false);
    let all: Vec<_> = (0..22)
        .map(|i| container(&format!("svc-{i}"), "running", "Up"))
        .collect();
    t.observe(docker(all), 0);
    t.observe(docker(vec![]), 100);
    assert_eq!(t.snapshot().cgone.len(), 20);
}

#[test]
fn docker_errors_and_missing_docker_freeze_the_container_list() {
    let mut t = tracker(false);
    t.observe(docker(vec![container("web", "running", "Up")]), 0);
    let bad = Reading {
        containers: Some(vec![]),
        docker_error: Some("denied".into()),
        ..Reading::default()
    };
    assert!(t.observe(bad, 5).is_empty());
    assert!(t.observe(Reading::default(), 10).is_empty());
    assert!(t.snapshot().cgone.is_empty());
}

#[test]
fn failed_units_come_and_go() {
    let mut t = tracker(false);
    let with = |units: &[&str]| Reading {
        failed_services: units
            .iter()
            .map(|u| FailedService { unit: (*u).into() })
            .collect(),
        ..Reading::default()
    };
    assert!(t.observe(with(&["old.service"]), 0).is_empty()); // baseline
    let ev = t.observe(with(&["old.service", "b.service"]), 3);
    assert_eq!(texts(&ev), ["service b.service failed"]);
    assert_eq!(
        texts(&t.observe(with(&["b.service"]), 6)),
        ["service old.service recovered"]
    );
}
