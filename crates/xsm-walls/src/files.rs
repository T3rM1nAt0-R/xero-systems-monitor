//! Shared helpers: finding the repo, walking files, trimming test code.

use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// A text file and its path relative to the repo root (forward slashes).
#[derive(Debug, Clone)]
pub struct SourceFile {
    /// Path relative to the repo root.
    pub path: String,
    /// File contents.
    pub text: String,
}

impl SourceFile {
    /// Build a file from a path and text (used for bad samples in tests).
    #[must_use]
    pub fn new(path: &str, text: &str) -> SourceFile {
        SourceFile {
            path: path.to_owned(),
            text: text.to_owned(),
        }
    }
}

/// Directories that are never checked.
const SKIPPED_DIRS: [&str; 3] = ["target", ".git", "node_modules"];

/// The repo root: two levels above this crate.
#[must_use]
pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Every readable text file under `root` whose relative path passes `keep`.
#[must_use]
pub fn collect(root: &Path, keep: fn(&str) -> bool) -> Vec<SourceFile> {
    let walk = WalkDir::new(root)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !SKIPPED_DIRS.iter().any(|s| e.file_name() == *s));
    let mut out = Vec::new();
    for entry in walk.flatten().filter(|e| e.file_type().is_file()) {
        let Ok(rel) = entry.path().strip_prefix(root) else {
            continue;
        };
        let rel = rel.to_string_lossy().replace('\\', "/");
        if !keep(&rel) {
            continue;
        }
        if let Ok(text) = fs::read_to_string(entry.path()) {
            out.push(SourceFile { path: rel, text });
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out
}

/// Read one text file, given its path relative to `root`.
///
/// # Errors
/// Returns a message naming the file when it cannot be read.
pub fn read_text(root: &Path, rel: &str) -> Result<String, String> {
    fs::read_to_string(root.join(rel)).map_err(|e| format!("{rel}: {e}"))
}

/// The file extension, or an empty string.
#[must_use]
pub fn ext(path: &str) -> &str {
    path.rsplit_once('.').map_or("", |(_, e)| e)
}

/// True when the path is inside a `tests` directory.
#[must_use]
pub fn is_test_path(path: &str) -> bool {
    path.split('/').any(|part| part == "tests")
}

/// Cut a Rust file at its first `#[cfg(test)]` line (test modules go last).
#[must_use]
pub fn strip_test_tail(text: &str) -> &str {
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        if line.trim() == "#[cfg(test)]" {
            return &text[..offset];
        }
        offset += line.len();
    }
    text
}

/// Source files that are not tests, with Rust test modules cut off.
/// Yields `(path, code)` for `.rs`, `.js`, `.jsx` and `.sh` files.
pub fn code(files: &[SourceFile]) -> impl Iterator<Item = (&str, &str)> {
    files
        .iter()
        .filter(|f| !is_test_path(&f.path) && matches!(ext(&f.path), "rs" | "js" | "jsx" | "sh"))
        .map(|f| {
            let text = if ext(&f.path) == "rs" {
                strip_test_tail(&f.text)
            } else {
                f.text.as_str()
            };
            (f.path.as_str(), text)
        })
}

/// The crate directory name for a path like `crates/xsm-core/src/lib.rs`.
#[must_use]
pub fn crate_of(path: &str) -> Option<&str> {
    path.strip_prefix("crates/")?.split('/').next()
}

/// Compile a pattern that is fixed in the source.
///
/// # Panics
/// Panics when the pattern is not valid, which is a bug in the wall.
#[must_use]
pub fn re(pattern: &str) -> Regex {
    match Regex::new(pattern) {
        Ok(r) => r,
        Err(e) => panic!("bad wall pattern {pattern}: {e}"),
    }
}

/// Fail a test with every violation listed.
///
/// # Panics
/// Panics when `violations` is not empty.
pub fn assert_clean(wall: &str, violations: &[String]) {
    assert!(
        violations.is_empty(),
        "wall {wall} failed:\n{}",
        violations.join("\n")
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helpers() {
        assert_eq!(ext("a/b.rs"), "rs");
        assert_eq!(ext("Makefile"), "");
        assert!(is_test_path("crates/x/tests/a.rs"));
        assert!(!is_test_path("crates/x/src/a.rs"));
        assert_eq!(crate_of("crates/xsm-core/src/lib.rs"), Some("xsm-core"));
        assert_eq!(crate_of("settings/a.json"), None);
        assert_eq!(strip_test_tail("a\n#[cfg(test)]\nb\n"), "a\n");
        assert_eq!(strip_test_tail("a\nb\n"), "a\nb\n");
    }

    #[test]
    fn code_skips_tests_and_cuts_test_modules() {
        let files = [
            SourceFile::new("crates/a/src/lib.rs", "x\n#[cfg(test)]\ny\n"),
            SourceFile::new("crates/a/tests/t.rs", "z"),
            SourceFile::new("notes.md", "m"),
        ];
        let got: Vec<_> = code(&files).collect();
        assert_eq!(got, vec![("crates/a/src/lib.rs", "x\n")]);
    }

    #[test]
    fn collect_finds_this_file_and_skips_target() {
        let found = collect(&repo_root(), |p| p.ends_with("files.rs"));
        assert!(found
            .iter()
            .any(|f| f.path == "crates/xsm-walls/src/files.rs"));
        assert!(found.iter().all(|f| !f.path.starts_with("target/")));
    }
}
