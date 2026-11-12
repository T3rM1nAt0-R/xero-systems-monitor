//! Wall: no unexplained `#[allow]`, no `unsafe` outside `xsm-sources`, no `unwrap`/`expect` outside tests.

use crate::files::{code, ext, re, SourceFile};

/// The one crate that may use `unsafe` (Windows APIs).
const UNSAFE_HOME: &str = "crates/xsm-sources/";

/// Report escape hatches in non-test Rust code.
#[must_use]
pub fn check(files: &[SourceFile]) -> Vec<String> {
    let unsafe_word = re(r"\bunsafe\b");
    let unwrap_call = re(r"\.unwrap\(\)|\.expect\(");
    let string_literal = re(r#""(?:[^"\\]|\\.)*""#);
    let mut out = Vec::new();
    for (path, text) in code(files).filter(|(p, _)| ext(p) == "rs") {
        let lines: Vec<&str> = text.lines().collect();
        for (n, raw) in lines.iter().enumerate() {
            let trimmed = raw.trim_start();
            if trimmed.starts_with("//") {
                continue;
            }
            let line = string_literal.replace_all(trimmed, "\"\"");
            let line = line.as_ref();
            let at = format!("{path}:{}", n + 1);
            if line.starts_with("#[allow(") || line.starts_with("#![allow(") {
                let reason = n > 0 && lines[n - 1].trim_start().starts_with("// reason:");
                if !reason {
                    out.push(format!("{at}: allow without a `// reason:` comment above"));
                }
            }
            if !path.starts_with(UNSAFE_HOME) && unsafe_word.is_match(line) {
                out.push(format!("{at}: unsafe outside xsm-sources"));
            }
            if unwrap_call.is_match(line) {
                out.push(format!("{at}: unwrap/expect outside tests"));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(path: &str, text: &str) -> usize {
        check(&[SourceFile::new(path, text)]).len()
    }

    #[test]
    fn fails_on_bad_samples() {
        let lib = "crates/xsm-core/src/lib.rs";
        assert_eq!(run(lib, "#[allow(dead_code)]\nfn f() {}\n"), 1);
        assert_eq!(run(lib, "// note\n#[allow(dead_code)]\nfn f() {}\n"), 1);
        assert_eq!(run(lib, "fn f() { unsafe { g() } }\n"), 1);
        assert_eq!(run(lib, "fn f() { x.unwrap(); }\n"), 1);
        assert_eq!(run(lib, "fn f() { x.expect(\"m\"); }\n"), 1);
    }

    #[test]
    fn passes_on_allowed_uses() {
        let lib = "crates/xsm-core/src/lib.rs";
        assert_eq!(
            run(
                lib,
                "// reason: kept for later\n#[allow(dead_code)]\nfn f() {}\n"
            ),
            0
        );
        assert_eq!(
            run(
                "crates/xsm-sources/src/lib.rs",
                "fn f() { unsafe { g() } }\n"
            ),
            0
        );
        assert_eq!(
            run(lib, "// x.unwrap() is fine in a comment\nfn f() {}\n"),
            0
        );
        assert_eq!(
            run(
                lib,
                "fn f() {}\n#[cfg(test)]\nmod t { fn g() { x.unwrap(); } }\n"
            ),
            0
        );
        assert_eq!(run("crates/a/tests/t.rs", "fn g() { x.unwrap(); }\n"), 0);
    }
}
