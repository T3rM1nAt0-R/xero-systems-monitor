//! Tracker: online/offline, events, runner jobs, containers, window shape.

use serde_json::json;
use xsm_core::reading::{JobLine, Reading, RunnerState};
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

fn running_job(runner: &str) -> JobLine {
    JobLine {
        runner: runner.into(),
        name: "Build".into(),
        repo: "o/example-repo".into(),
        git_ref: "refs/pull/7/merge".into(),
        head_ref: "fix-it".into(),
        ..JobLine::default()
    }
}

fn result_line(runner: &str, result: &str, log: &str) -> JobLine {
    JobLine {
        runner: runner.into(),
        result: Some(result.into()),
        result_log: Some(log.into()),
        ..JobLine::default()
    }
}

fn runners(busy: bool, jobs: Vec<JobLine>) -> Reading {
    Reading {
        runners: vec![RunnerState {
            name: "r1".into(),
            busy,
        }],
        jobs,
        ..Reading::default()
    }
}

#[test]
fn offline_after_misses_and_back_online() {
    let mut t = tracker(false);
    assert_eq!(t.snapshot().err.as_deref(), Some("starting"));
    assert!(t.miss(10).is_empty());
    assert!(t.miss(13).is_empty());
    let ev = t.miss(16);
    assert_eq!(
        (texts(&ev), ev[0].t, ev[0].machine.as_str()),
        (vec!["went offline"], 16, "example-server")
    );
    assert!(t.miss(19).is_empty()); // said once
    assert!(t.snapshot().err.is_some());
    assert_eq!(texts(&t.observe(Reading::default(), 20)), ["back online"]);
    assert_eq!((t.snapshot().err, t.snapshot().t), (None, Some(20)));
    assert!(t.observe(Reading::default(), 23).is_empty());
}

#[test]
fn first_answer_is_silent_and_misses_reset() {
    let mut t = tracker(false);
    t.miss(1);
    t.miss(2);
    assert!(t.observe(Reading::default(), 3).is_empty());
    t.miss(4);
    t.miss(5);
    assert!(t.snapshot().err.is_none()); // the answer reset the count
}

#[test]
fn keeps_the_last_reading_while_offline() {
    let mut t = tracker(false);
    t.observe(
        Reading {
            ping_ms: Some(9.0),
            ..Reading::default()
        },
        1,
    );
    for i in 0..3 {
        t.miss(2 + i);
    }
    assert_eq!(t.snapshot().latest.ping_ms, Some(9.0));
}

#[test]
fn runner_job_waits_for_its_result() {
    let mut t = tracker(true);
    t.observe(runners(false, vec![]), 100);
    let ev = t.observe(runners(true, vec![running_job("r1")]), 160);
    assert_eq!(
        texts(&ev),
        ["r1 started: PR #7 · fix-it · Build (example-repo)"]
    );
    assert_eq!(t.snapshot().started["r1"], 160);
    let ev = t.observe(
        runners(false, vec![result_line("r1", "Succeeded", "W1.log")]),
        460,
    );
    assert_eq!(
        texts(&ev),
        ["r1 finished (5 min, Succeeded): PR #7 · fix-it · Build (example-repo)"]
    );
    let done = t.take_finished();
    assert_eq!(
        (
            done.len(),
            done[0].start,
            done[0].end,
            done[0].result.as_str()
        ),
        (1, 160, 460, "Succeeded")
    );
    assert_eq!(
        serde_json::to_value(&done[0]).unwrap(),
        json!([
            "example-server",
            "r1",
            160,
            460,
            "Succeeded",
            "PR #7 · fix-it · Build (example-repo)"
        ])
    );
    assert!(t.take_finished().is_empty());
    assert!(t.snapshot().started.is_empty());
}

#[test]
fn finish_without_a_result_is_logged_after_four_polls() {
    let mut t = tracker(true);
    t.observe(runners(false, vec![]), 0);
    t.observe(runners(true, vec![running_job("r1")]), 10);
    for i in 0..3 {
        assert!(t.observe(runners(false, vec![]), 20 + i).is_empty());
    }
    let ev = t.observe(runners(false, vec![]), 30);
    assert_eq!(
        texts(&ev),
        ["r1 finished (0 min): PR #7 · fix-it · Build (example-repo)"]
    );
    assert_eq!(t.take_finished()[0].result, "");
}

#[test]
fn a_result_log_is_used_once() {
    let mut t = tracker(true);
    t.observe(runners(false, vec![]), 0);
    t.observe(runners(true, vec![running_job("r1")]), 10);
    t.observe(
        runners(false, vec![result_line("r1", "Failed", "W1.log")]),
        70,
    );
    assert_eq!(t.take_finished()[0].result, "Failed");
    t.observe(runners(true, vec![running_job("r1")]), 100);
    for i in 0..3 {
        t.observe(
            runners(false, vec![result_line("r1", "Failed", "W1.log")]),
            160 + i,
        );
        assert!(t.take_finished().is_empty()); // the same log is not a new result
    }
    t.observe(
        runners(false, vec![result_line("r1", "Failed", "W1.log")]),
        170,
    );
    assert_eq!(t.take_finished()[0].result, "");
}

#[test]
fn a_result_line_with_no_log_name_still_counts() {
    let mut t = tracker(true);
    t.observe(runners(false, vec![]), 0);
    t.observe(runners(true, vec![running_job("r1")]), 10);
    let mut res = result_line("r1", "Failed", "");
    res.result_log = None;
    t.observe(runners(false, vec![res]), 20);
    assert_eq!(t.take_finished()[0].result, "Failed");
}

#[test]
fn jobs_already_running_at_first_answer_are_not_new() {
    let mut t = tracker(true);
    assert!(t
        .observe(runners(true, vec![running_job("r1")]), 50)
        .is_empty());
    assert_eq!(t.snapshot().started["r1"], 50);
}

#[test]
fn runner_gone_and_back() {
    let mut t = tracker(true);
    t.observe(runners(false, vec![]), 0);
    let ev = t.observe(Reading::default(), 5);
    assert_eq!(texts(&ev), ["runner r1 gone"]);
    assert!(t.observe(Reading::default(), 8).is_empty());
    assert_eq!(t.snapshot().gone.len(), 1);
    assert_eq!(
        texts(&t.observe(runners(false, vec![]), 10)),
        ["runner r1 back"]
    );
    assert!(t.snapshot().gone.is_empty());
}

#[test]
fn machines_without_runners_ignore_them() {
    let mut t = tracker(false);
    assert!(t.observe(Reading::default(), 0).is_empty());
    assert!(t
        .observe(runners(true, vec![running_job("r1")]), 5)
        .is_empty());
    assert!(t.snapshot().started.is_empty());
}

#[test]
fn job_label_variants() {
    let mut t = tracker(true);
    t.observe(runners(false, vec![]), 0);
    let bare = JobLine {
        runner: "r1".into(),
        ..JobLine::default()
    };
    assert_eq!(
        texts(&t.observe(runners(true, vec![bare]), 1)),
        ["r1 started: busy"]
    );
    t.observe(runners(false, vec![]), 2);
    let long = JobLine {
        runner: "r1".into(),
        git_ref: "refs/heads/".to_owned() + &"b".repeat(50),
        repo: "o/".into(),
        ..JobLine::default()
    };
    let ev = t.observe(runners(true, vec![long]), 3);
    assert_eq!(ev[0].text, format!("r1 started: {}…", "b".repeat(43)));
    let plain = JobLine {
        runner: "r1".into(),
        repo: "o/example-repo".into(),
        git_ref: "refs/pull/x/merge".into(),
        ..JobLine::default()
    };
    t.observe(runners(false, vec![]), 4);
    let ev = t.observe(runners(true, vec![plain]), 5);
    assert_eq!(ev[0].text, "r1 started: refs/pull/x/merge (example-repo)");
    let main = JobLine {
        runner: "r1".into(),
        git_ref: "refs/heads/main".into(),
        ..JobLine::default()
    };
    t.observe(runners(false, vec![]), 6);
    assert_eq!(
        t.observe(runners(true, vec![main]), 7)[0].text,
        "r1 started: main"
    );
}

#[test]
fn event_serializes_as_a_row() {
    let mut t = tracker(false);
    let ev = t.miss(5);
    assert!(ev.is_empty());
    let mut t = Tracker::new(
        "m",
        Rules {
            offline_after_misses: 1,
            has_runners: false,
        },
    );
    let ev = t.miss(5);
    let v: serde_json::Value = serde_json::to_value(&ev).unwrap();
    assert_eq!(v, json!([[5, "m", "went offline"]]));
}
