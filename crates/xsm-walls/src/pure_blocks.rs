//! Wall: pure blocks never touch files, network, processes, threads, the clock or randomness.

use crate::files::SourceFile;
use crate::rustsrc::{is_cfg_test, parse, use_paths};
use syn::visit::{self, Visit};
use syn::{ItemMod, ItemUse, Path};

/// `std` modules that pure blocks may not use.
const BANNED_MODULES: [&str; 4] = ["fs", "net", "process", "thread"];
/// Types that read the clock.
const BANNED_NAMES: [&str; 2] = ["SystemTime", "Instant"];

fn is_banned(segments: &[String]) -> bool {
    let first = segments.first().map(String::as_str);
    let second = segments.get(1).map(String::as_str);
    segments.iter().any(|s| BANNED_NAMES.contains(&s.as_str()))
        || first == Some("rand")
        || (matches!(first, Some("std" | "core"))
            && second.is_some_and(|m| BANNED_MODULES.contains(&m)))
}

struct Finder {
    found: Vec<String>,
}

impl<'ast> Visit<'ast> for Finder {
    fn visit_item_mod(&mut self, m: &'ast ItemMod) {
        if !is_cfg_test(&m.attrs) {
            visit::visit_item_mod(self, m);
        }
    }

    fn visit_item_use(&mut self, u: &'ast ItemUse) {
        for path in use_paths(&u.tree) {
            if is_banned(&path) {
                self.found.push(path.join("::"));
            }
        }
    }

    fn visit_path(&mut self, p: &'ast Path) {
        let segments: Vec<String> = p.segments.iter().map(|s| s.ident.to_string()).collect();
        if is_banned(&segments) {
            self.found.push(segments.join("::"));
        }
        visit::visit_path(self, p);
    }
}

/// Report banned paths in the given pure-block Rust files.
#[must_use]
pub fn check(files: &[SourceFile]) -> Vec<String> {
    let mut out = Vec::new();
    for f in files {
        match parse(&f.text) {
            Ok(ast) => {
                let mut finder = Finder { found: Vec::new() };
                finder.visit_file(&ast);
                out.extend(finder.found.iter().map(|p| format!("{}: uses {p}", f.path)));
            }
            Err(e) => out.push(format!("{}: cannot parse: {e}", f.path)),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(src: &str) -> Vec<String> {
        check(&[SourceFile::new("a.rs", src)])
    }

    #[test]
    fn fails_on_io_and_clock() {
        assert_eq!(run("use std::fs;").len(), 1);
        assert_eq!(run("use std::{io, net::TcpStream};").len(), 1);
        assert_eq!(run("fn f() { let _ = std::process::id(); }").len(), 1);
        assert_eq!(run("use std::time::{Instant, SystemTime};").len(), 2);
        assert_eq!(run("fn f() { std::thread::yield_now(); }").len(), 1);
        assert_eq!(run("use rand::Rng;").len(), 1);
    }

    #[test]
    fn passes_on_pure_code_and_test_modules() {
        assert!(run("use std::fmt; use std::time::Duration; fn f() {}").is_empty());
        assert!(run("#[cfg(test)] mod tests { use std::fs; }").is_empty());
    }
}
