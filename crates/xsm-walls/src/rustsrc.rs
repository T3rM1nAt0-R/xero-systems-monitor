//! Shared Rust parsing helpers (one home for `syn` use).

use syn::{Attribute, Meta, UseTree};

/// Parse Rust source.
///
/// # Errors
/// Returns the parse error text.
pub fn parse(text: &str) -> Result<syn::File, String> {
    syn::parse_file(text).map_err(|e| e.to_string())
}

/// True when the attributes include `#[cfg(test)]`.
#[must_use]
pub fn is_cfg_test(attrs: &[Attribute]) -> bool {
    attrs.iter().any(|a| match &a.meta {
        Meta::List(list) => list.path.is_ident("cfg") && list.tokens.to_string() == "test",
        _ => false,
    })
}

/// Flatten a `use` tree into full paths, e.g. `std::{fs, io}` into
/// `std::fs` and `std::io`.
#[must_use]
pub fn use_paths(tree: &UseTree) -> Vec<Vec<String>> {
    match tree {
        UseTree::Path(p) => {
            let mut out = use_paths(&p.tree);
            for path in &mut out {
                path.insert(0, p.ident.to_string());
            }
            out
        }
        UseTree::Name(n) => vec![vec![n.ident.to_string()]],
        UseTree::Rename(r) => vec![vec![r.ident.to_string()]],
        UseTree::Glob(_) => vec![vec!["*".to_owned()]],
        UseTree::Group(g) => g.items.iter().flat_map(use_paths).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flattens_groups() {
        let file = parse("use std::{fs, io::Read};").unwrap();
        let syn::Item::Use(u) = &file.items[0] else {
            panic!("not a use");
        };
        let paths: Vec<String> = use_paths(&u.tree).iter().map(|p| p.join("::")).collect();
        assert_eq!(paths, vec!["std::fs", "std::io::Read"]);
    }

    #[test]
    fn detects_cfg_test() {
        let file = parse("#[cfg(test)] mod a {} #[cfg(unix)] mod b {}").unwrap();
        let flags: Vec<bool> = file
            .items
            .iter()
            .map(|i| match i {
                syn::Item::Mod(m) => is_cfg_test(&m.attrs),
                _ => false,
            })
            .collect();
        assert_eq!(flags, vec![true, false]);
    }

    #[test]
    fn parse_error_is_reported() {
        assert!(parse("fn (").is_err());
    }
}
