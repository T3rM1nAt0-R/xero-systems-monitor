//! Wall: a job named in `walls/one-home.txt` is done only in its home file.

use crate::files::{code, SourceFile};

/// Check code files against lines of `job | home file | regex`
/// (`#` comments and blank lines ignored).
#[must_use]
pub fn check(rules_text: &str, files: &[SourceFile]) -> Vec<String> {
    let mut out = Vec::new();
    for line in rules_text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
    {
        let parts: Vec<&str> = line.splitn(3, '|').map(str::trim).collect();
        let [job, home, pattern] = parts[..] else {
            out.push(format!(
                "walls/one-home.txt: expected `job | home file | regex`: {line}"
            ));
            continue;
        };
        let Ok(regex) = regex::Regex::new(pattern) else {
            out.push(format!("walls/one-home.txt: bad regex for {job}"));
            continue;
        };
        if !files.iter().any(|f| f.path == home) {
            out.push(format!(
                "walls/one-home.txt: home file {home} for {job} not found"
            ));
        }
        for (path, text) in code(files) {
            if path != home && regex.is_match(text) {
                out.push(format!("{path}: {job} belongs in {home}"));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const RULES: &str = "# jobs\nreading json | crates/a/src/home.rs | serde_json::from_str\n";

    fn files(other: &str) -> Vec<SourceFile> {
        vec![
            SourceFile::new(
                "crates/a/src/home.rs",
                "fn r() { serde_json::from_str(s); }",
            ),
            SourceFile::new("crates/a/src/other.rs", other),
        ]
    }

    #[test]
    fn fails_when_job_done_elsewhere() {
        assert_eq!(
            check(RULES, &files("fn x() { serde_json::from_str(s); }")).len(),
            1
        );
    }

    #[test]
    fn passes_when_only_home_does_it() {
        assert!(check(RULES, &files("fn x() {}")).is_empty());
    }

    #[test]
    fn fails_on_bad_rules() {
        assert_eq!(check("only | two", &files("")).len(), 1);
        assert_eq!(check("j | crates/a/src/home.rs | (", &files("")).len(), 1);
        assert_eq!(check("j | missing.rs | x", &files("")).len(), 1);
    }
}
