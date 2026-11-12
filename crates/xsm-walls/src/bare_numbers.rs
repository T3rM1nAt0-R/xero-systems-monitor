//! Wall: in pure blocks every number other than 0 and 1 is a named `const`.

use crate::files::SourceFile;
use crate::rustsrc::{is_cfg_test, parse};
use syn::visit::{self, Visit};
use syn::{ImplItemConst, ItemConst, ItemMod, ItemStatic, Lit, TraitItemConst};

/// Number literals that need no name.
const ALLOWED: [&str; 4] = ["0", "1", "0.0", "1.0"];

struct Finder {
    found: Vec<String>,
}

impl<'ast> Visit<'ast> for Finder {
    fn visit_item_const(&mut self, _: &'ast ItemConst) {}
    fn visit_item_static(&mut self, _: &'ast ItemStatic) {}
    fn visit_impl_item_const(&mut self, _: &'ast ImplItemConst) {}
    fn visit_trait_item_const(&mut self, _: &'ast TraitItemConst) {}

    fn visit_item_mod(&mut self, m: &'ast ItemMod) {
        if !is_cfg_test(&m.attrs) {
            visit::visit_item_mod(self, m);
        }
    }

    fn visit_lit(&mut self, lit: &'ast Lit) {
        let digits = match lit {
            Lit::Int(i) => i.base10_digits().to_owned(),
            Lit::Float(f) => f.base10_digits().to_owned(),
            _ => return,
        };
        if !ALLOWED.contains(&digits.as_str()) {
            self.found.push(digits);
        }
    }
}

/// Report bare number literals in the given pure-block Rust files.
#[must_use]
pub fn check(files: &[SourceFile]) -> Vec<String> {
    let mut out = Vec::new();
    for f in files {
        match parse(&f.text) {
            Ok(ast) => {
                let mut finder = Finder { found: Vec::new() };
                finder.visit_file(&ast);
                out.extend(
                    finder
                        .found
                        .iter()
                        .map(|n| format!("{}: bare number {n}, make it a named const", f.path)),
                );
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
    fn fails_on_bare_numbers() {
        assert_eq!(run("fn f() -> u32 { 42 }").len(), 1);
        assert_eq!(run("fn f() -> f64 { 2.5 }").len(), 1);
        assert_eq!(run("fn f(x: u32) -> bool { x == 7 }").len(), 1);
    }

    #[test]
    fn passes_on_consts_zero_one_and_tests() {
        assert!(run("const N: u32 = 42; static M: u32 = 7; fn f() -> u32 { N + 1 }").is_empty());
        assert!(run("struct S; impl S { const K: u32 = 9; } fn f() -> u32 { 0 }").is_empty());
        assert!(run("#[cfg(test)] mod tests { fn t() -> u32 { 99 } }").is_empty());
    }

    #[test]
    fn reports_unparsable_files() {
        assert_eq!(run("fn (").len(), 1);
    }
}
