//! Wall: no private IPs, personal paths or secrets anywhere in the repo.

use crate::files::{re, SourceFile};

/// Pattern name and regex. Use `192.0.2.x`, `example-server` and `user` instead.
const PATTERNS: [(&str, &str); 7] = [
    (
        "private IPv4 address",
        r"(^|[^0-9.])(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})($|[^0-9])",
    ),
    ("Windows user path", r"[A-Za-z]:\\Users\\[A-Za-z]"),
    ("GitHub token", r"ghp_[A-Za-z0-9]{20,}"),
    ("GitHub fine-grained token", r"github_pat_[A-Za-z0-9_]{20,}"),
    ("API secret key", r"\bsk-[A-Za-z0-9_-]{20,}"),
    ("AWS access key", r"\bAKIA[0-9A-Z]{16}\b"),
    ("private key block", r"-----BEGIN [A-Z ]*PRIVATE KEY"),
];

/// Files never scanned: the walls' own sources and generated lock files.
fn skipped(path: &str) -> bool {
    path.starts_with("crates/xsm-walls/")
        || path.ends_with("Cargo.lock")
        || path.ends_with("package-lock.json")
}

/// Report each personal-data match with file and line number.
#[must_use]
pub fn check(files: &[SourceFile]) -> Vec<String> {
    let compiled: Vec<_> = PATTERNS.iter().map(|(name, p)| (*name, re(p))).collect();
    let mut out = Vec::new();
    for f in files.iter().filter(|f| !skipped(&f.path)) {
        for (n, line) in f.text.lines().enumerate() {
            for (name, regex) in &compiled {
                if regex.is_match(line) {
                    out.push(format!("{}:{}: {name}", f.path, n + 1));
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(text: &str) -> usize {
        check(&[SourceFile::new("notes.txt", text)]).len()
    }

    #[test]
    fn fails_on_bad_samples() {
        for ip in [
            ["10", "1", "2", "3"],
            ["192", "168", "0", "9"],
            ["172", "20", "1", "1"],
        ] {
            assert_eq!(run(&format!("host {}", ip.join("."))), 1);
        }
        assert_eq!(run(&format!("{}:{}Users{}me", 'C', '\\', '\\')), 1);
        assert_eq!(run(&format!("{}{}", "ghp_", "a".repeat(30))), 1);
        assert_eq!(run(&format!("{}{}", "github_pat_", "a".repeat(30))), 1);
        assert_eq!(run(&format!("{}{}", "sk-", "a".repeat(30))), 1);
        assert_eq!(run(&format!("{}{}", "AKIA", "A".repeat(16))), 1);
        assert_eq!(run(&format!("{} RSA PRIVATE KEY-----", "-----BEGIN")), 1);
    }

    #[test]
    fn passes_on_safe_text() {
        assert_eq!(
            run("host 192.0.2.10 on example-server, version 1.10.2.3, 172.32.0.1"),
            0
        );
    }

    #[test]
    fn skips_the_walls_own_samples() {
        let sample = format!("{}.{}.{}.{}", "10", "0", "0", "1");
        assert!(check(&[SourceFile::new("crates/xsm-walls/tests/x.txt", &sample)]).is_empty());
    }
}
