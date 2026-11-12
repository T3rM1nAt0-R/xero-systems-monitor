//! Wall: no source file over 400 lines.

use crate::files::{ext, SourceFile};

/// Most lines a `.rs`, `.js`, `.jsx` or `.sh` file may have.
pub const MAX_LINES: usize = 400;

/// Report each source file with more than [`MAX_LINES`] lines.
#[must_use]
pub fn check(files: &[SourceFile]) -> Vec<String> {
    files
        .iter()
        .filter(|f| matches!(ext(&f.path), "rs" | "js" | "jsx" | "sh"))
        .filter(|f| f.text.lines().count() > MAX_LINES)
        .map(|f| format!("{}: over {MAX_LINES} lines, split it", f.path))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(n: usize) -> String {
        "x\n".repeat(n)
    }

    #[test]
    fn fails_on_long_file() {
        let bad = [SourceFile::new("a.rs", &lines(MAX_LINES + 1))];
        assert_eq!(check(&bad).len(), 1);
    }

    #[test]
    fn passes_on_limit_and_other_types() {
        let ok = [
            SourceFile::new("a.rs", &lines(MAX_LINES)),
            SourceFile::new("b.md", &lines(MAX_LINES * 2)),
        ];
        assert!(check(&ok).is_empty());
    }
}
