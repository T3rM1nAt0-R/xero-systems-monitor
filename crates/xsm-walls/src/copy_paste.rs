//! Wall: the same run of 100 tokens may appear only once in Rust code.

use crate::files::{code, ext, re, SourceFile};
use std::collections::{BTreeSet, HashMap};

/// Length of a repeated run that counts as a pasted copy.
pub const WINDOW: usize = 100;

fn tokens(text: &str) -> Vec<String> {
    let code_only: String = text
        .lines()
        .filter(|l| !l.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n");
    let token = re(r#"[A-Za-z_][A-Za-z0-9_]*|[0-9][0-9A-Za-z_.]*|"(?:[^"\\]|\\.)*"|\S"#);
    token
        .find_iter(&code_only)
        .map(|m| m.as_str().to_owned())
        .collect()
}

/// Report pairs of files that share a run of [`WINDOW`] tokens.
#[must_use]
pub fn check(files: &[SourceFile]) -> Vec<String> {
    let mut seen: HashMap<String, (&str, usize)> = HashMap::new();
    let mut reported = BTreeSet::new();
    let mut out = Vec::new();
    for (path, text) in code(files).filter(|(p, _)| ext(p) == "rs") {
        let toks = tokens(text);
        for start in 0..toks.len().saturating_sub(WINDOW - 1) {
            let key = toks[start..start + WINDOW].join(" ");
            match seen.get(&key) {
                Some(&(first, at)) if (first, at) != (path, start) => {
                    if reported.insert((first, path)) {
                        out.push(format!(
                            "{path}: {WINDOW} tokens at token {start} repeat {first} at token {at}"
                        ));
                    }
                }
                Some(_) => {}
                None => {
                    seen.insert(key, (path, start));
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(offset: usize) -> String {
        let lets: Vec<String> = (offset..offset + 30)
            .map(|i| format!("let v{i} = {i};"))
            .collect();
        format!("fn f() {{ {} }}", lets.join(" "))
    }

    #[test]
    fn fails_on_pasted_copy() {
        let files = [
            SourceFile::new("crates/a/src/one.rs", &body(0)),
            SourceFile::new("crates/a/src/two.rs", &body(0)),
        ];
        assert_eq!(check(&files).len(), 1);
    }

    #[test]
    fn passes_on_different_code_and_tests() {
        let files = [
            SourceFile::new("crates/a/src/one.rs", &body(0)),
            SourceFile::new("crates/a/src/two.rs", &body(100)),
            SourceFile::new("crates/a/tests/three.rs", &body(0)),
        ];
        assert!(check(&files).is_empty());
    }

    #[test]
    fn short_repeats_are_fine() {
        let short = "fn f() { let a = 1; }";
        let files = [
            SourceFile::new("crates/a/src/one.rs", short),
            SourceFile::new("crates/a/src/two.rs", short),
        ];
        assert!(check(&files).is_empty());
    }
}
