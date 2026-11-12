//! Container and systemd-unit changes: what fell over, recovered, vanished or keeps restarting.

use crate::reading::ContainerState;
use std::collections::{BTreeMap, BTreeSet, VecDeque};

/// This many state changes inside `FLAP_WINDOW_S` is "keeps restarting".
const FLAP_COUNT: usize = 4;
/// The flapping window, seconds.
const FLAP_WINDOW_S: i64 = 1800;
/// State changes remembered per container.
const FLAP_KEPT: usize = 20;
/// A container must have been seen this long before its disappearing counts.
const GONE_AFTER_S: i64 = 60;
/// A gone container stays on the card this long.
const GONE_KEPT_S: i64 = 86_400;
/// At most this many gone containers are kept.
const GONE_MAX: usize = 20;
/// Names made only of hex digits this long are throw-away CI containers.
const HASH_NAME: usize = 12;
/// A hex prefix this long, then `_`, is also a throw-away name.
const HASH_PREFIX: usize = 20;
/// The event text that means a container keeps restarting.
pub(crate) const FLAP_PHRASE: &str = "keeps restarting";
const SECS_PER_MIN: i64 = 60;

fn is_hex(s: &str) -> bool {
    s.bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn is_throwaway(name: &str) -> bool {
    (name.len() >= HASH_NAME && is_hex(name))
        || name
            .split_once('_')
            .is_some_and(|(p, _)| p.len() >= HASH_PREFIX && is_hex(p))
}

/// A container that disappeared: when, last state, last status text, image.
pub(super) type Gone = (i64, String, String, String);

#[derive(Default)]
pub(super) struct Containers {
    /// Last states, `None` until the first answer (which only sets the baseline).
    states: Option<BTreeMap<String, (String, bool)>>,
    first_seen: BTreeMap<String, i64>,
    last: BTreeMap<String, ContainerState>,
    changes: BTreeMap<String, VecDeque<i64>>,
    flap_said: BTreeMap<String, i64>,
    pub(super) gone: BTreeMap<String, Gone>,
}

impl Containers {
    pub(super) fn observe(&mut self, list: &[ContainerState], now: i64) -> Vec<String> {
        let mut say = Vec::new();
        let baseline = self.states.is_none();
        let old_states = self.states.take().unwrap_or_default();
        let mut next = BTreeMap::new();
        for c in list {
            let (n, st, bad) = (&c.name, &c.state, c.is_failing());
            self.first_seen.entry(n.clone()).or_insert(now);
            self.last.insert(n.clone(), c.clone());
            if self.gone.remove(n).is_some() {
                say.push(format!("container {n} is back ({st})"));
            }
            let old = old_states.get(n).filter(|_| !baseline);
            if let Some((old_state, old_bad)) = old {
                if old_state != st {
                    say.extend(self.flap(n, now));
                }
                if bad && !old_bad {
                    say.push(format!("container {n} is {st}"));
                } else if old_state != "running" && st == "running" {
                    say.push(format!("container {n} is running again"));
                }
            } else if bad && !baseline {
                say.push(format!("container {n} is {st}"));
            }
            next.insert(n.clone(), (st.clone(), bad));
        }
        for n in old_states.keys().filter(|n| !next.contains_key(*n)) {
            let first = self.first_seen.remove(n).unwrap_or(now);
            if let Some(last) = self.last.remove(n) {
                if now - first >= GONE_AFTER_S && !is_throwaway(n) {
                    say.push(format!("container {n} disappeared (was {})", last.status));
                    self.gone
                        .insert(n.clone(), (now, last.state, last.status, last.image));
                }
            }
        }
        self.gone.retain(|_, g| now - g.0 <= GONE_KEPT_S);
        while self.gone.len() > GONE_MAX {
            let oldest = self
                .gone
                .iter()
                .min_by_key(|(_, g)| g.0)
                .map(|(k, _)| k.clone());
            if let Some(k) = oldest {
                self.gone.remove(&k);
            }
        }
        self.states = Some(next);
        say
    }

    fn flap(&mut self, name: &str, now: i64) -> Option<String> {
        let q = self.changes.entry(name.to_owned()).or_default();
        q.push_back(now);
        if q.len() > FLAP_KEPT {
            q.pop_front();
        }
        let recent = q.iter().filter(|&&t| now - t <= FLAP_WINDOW_S).count();
        let said = self.flap_said.get(name).copied();
        (recent >= FLAP_COUNT && said.is_none_or(|t| now - t > FLAP_WINDOW_S)).then(|| {
            self.flap_said.insert(name.to_owned(), now);
            format!(
                "container {name} {FLAP_PHRASE} ({recent} state changes in {} min)",
                FLAP_WINDOW_S / SECS_PER_MIN
            )
        })
    }
}

/// Failed systemd units; the first answer only sets the baseline.
#[derive(Default)]
pub(super) struct Units(Option<BTreeSet<String>>);

impl Units {
    pub(super) fn observe(&mut self, now: &BTreeSet<String>) -> Vec<String> {
        let mut say = Vec::new();
        if let Some(old) = &self.0 {
            say.extend(now.difference(old).map(|u| format!("service {u} failed")));
            say.extend(
                old.difference(now)
                    .map(|u| format!("service {u} recovered")),
            );
        }
        self.0 = Some(now.clone());
        say
    }
}
