//! Wall: the public items of each crate match `walls/front-doors.txt`.

use crate::files::SourceFile;
use crate::rustsrc::{parse, use_paths};
use std::collections::BTreeSet;
use syn::{Fields, ImplItem, Item, Type, Visibility};

fn is_pub(v: &Visibility) -> bool {
    matches!(v, Visibility::Public(_))
}

struct Walker<'a> {
    files: &'a [SourceFile],
    out: BTreeSet<String>,
    errors: Vec<String>,
}

impl Walker<'_> {
    fn add(&mut self, path: &str, name: &str, kind: &str) {
        self.out.insert(format!("{path}::{name} {kind}"));
    }

    fn module_file(&mut self, dir: &str, name: &str) -> Vec<Item> {
        for candidate in [format!("{dir}/{name}.rs"), format!("{dir}/{name}/mod.rs")] {
            if let Some(f) = self.files.iter().find(|f| f.path == candidate) {
                return match parse(&f.text) {
                    Ok(ast) => ast.items,
                    Err(e) => {
                        self.errors.push(format!("{candidate}: cannot parse: {e}"));
                        Vec::new()
                    }
                };
            }
        }
        self.errors
            .push(format!("{dir}: file for module {name} not found"));
        Vec::new()
    }

    fn walk(&mut self, items: &[Item], path: &str, dir: &str) {
        for item in items {
            match item {
                Item::Mod(m) if is_pub(&m.vis) => {
                    let name = m.ident.to_string();
                    self.add(path, &name, "mod");
                    let inner = match &m.content {
                        Some((_, inner)) => inner.clone(),
                        None => self.module_file(dir, &name),
                    };
                    self.walk(&inner, &format!("{path}::{name}"), &format!("{dir}/{name}"));
                }
                Item::Fn(i) if is_pub(&i.vis) => self.add(path, &i.sig.ident.to_string(), "fn"),
                Item::Const(i) if is_pub(&i.vis) => self.add(path, &i.ident.to_string(), "const"),
                Item::Static(i) if is_pub(&i.vis) => self.add(path, &i.ident.to_string(), "static"),
                Item::Type(i) if is_pub(&i.vis) => self.add(path, &i.ident.to_string(), "type"),
                Item::Trait(i) if is_pub(&i.vis) => self.add(path, &i.ident.to_string(), "trait"),
                Item::Use(i) if is_pub(&i.vis) => {
                    for p in use_paths(&i.tree) {
                        self.add(path, &p.join("::"), "use");
                    }
                }
                Item::Struct(i) if is_pub(&i.vis) => {
                    let name = i.ident.to_string();
                    self.add(path, &name, "struct");
                    if let Fields::Named(fields) = &i.fields {
                        for f in fields.named.iter().filter(|f| is_pub(&f.vis)) {
                            let field = f
                                .ident
                                .as_ref()
                                .map(ToString::to_string)
                                .unwrap_or_default();
                            self.add(path, &format!("{name}.{field}"), "field");
                        }
                    }
                }
                Item::Enum(i) if is_pub(&i.vis) => {
                    let name = i.ident.to_string();
                    self.add(path, &name, "enum");
                    for v in &i.variants {
                        self.add(path, &format!("{name}::{}", v.ident), "variant");
                    }
                }
                Item::Impl(i) if i.trait_.is_none() => self.walk_impl(i, path),
                _ => {}
            }
        }
    }

    fn walk_impl(&mut self, i: &syn::ItemImpl, path: &str) {
        let Type::Path(ty) = &*i.self_ty else { return };
        let Some(seg) = ty.path.segments.last() else {
            return;
        };
        for member in &i.items {
            match member {
                ImplItem::Fn(f) if is_pub(&f.vis) => {
                    self.add(path, &format!("{}::{}", seg.ident, f.sig.ident), "fn");
                }
                ImplItem::Const(c) if is_pub(&c.vis) => {
                    self.add(path, &format!("{}::{}", seg.ident, c.ident), "const");
                }
                _ => {}
            }
        }
    }
}

/// List the public items of one crate. `files` holds its `.rs` files and
/// `src_dir` is e.g. `crates/xsm-core/src`; the list starts at `lib.rs`.
///
/// # Errors
/// Returns problems finding or parsing the crate's files.
pub fn list(
    crate_name: &str,
    src_dir: &str,
    files: &[SourceFile],
) -> Result<Vec<String>, Vec<String>> {
    let root = format!("{src_dir}/lib.rs");
    let Some(lib) = files.iter().find(|f| f.path == root) else {
        return Err(vec![format!("{root}: not found")]);
    };
    let ast = parse(&lib.text).map_err(|e| vec![format!("{root}: cannot parse: {e}")])?;
    let mut walker = Walker {
        files,
        out: BTreeSet::new(),
        errors: Vec::new(),
    };
    walker.walk(&ast.items, &crate_name.replace('-', "_"), src_dir);
    if walker.errors.is_empty() {
        Ok(walker.out.into_iter().collect())
    } else {
        Err(walker.errors)
    }
}

/// Compare the listed public items with the text of `walls/front-doors.txt`
/// (one item per line, `#` comments and blank lines ignored).
#[must_use]
pub fn check(expected_text: &str, actual: &[String]) -> Vec<String> {
    let expected: BTreeSet<&str> = expected_text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .collect();
    let actual: BTreeSet<&str> = actual.iter().map(String::as_str).collect();
    let mut out: Vec<String> = actual
        .difference(&expected)
        .map(|l| format!("new public item, add to walls/front-doors.txt: {l}"))
        .collect();
    out.extend(
        expected
            .difference(&actual)
            .map(|l| format!("listed in walls/front-doors.txt but not public: {l}")),
    );
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lib(text: &str) -> Vec<SourceFile> {
        vec![SourceFile::new("crates/xsm-a/src/lib.rs", text)]
    }

    fn items(files: &[SourceFile]) -> Vec<String> {
        list("xsm-a", "crates/xsm-a/src", files).unwrap()
    }

    #[test]
    fn lists_public_items_only() {
        let files = lib("pub fn a() {} fn b() {} pub struct S { pub x: u8, y: u8 }
            impl S { pub fn new() -> S { S { x: 0, y: 0 } } fn hidden() {} }
            pub enum E { One } pub mod m { pub const C: u8 = 0; } pub(crate) fn c() {}");
        assert_eq!(
            items(&files),
            [
                "xsm_a::E enum",
                "xsm_a::E::One variant",
                "xsm_a::S struct",
                "xsm_a::S.x field",
                "xsm_a::S::new fn",
                "xsm_a::a fn",
                "xsm_a::m mod",
                "xsm_a::m::C const",
            ]
        );
    }

    #[test]
    fn follows_module_files() {
        let mut files = lib("pub mod parse;");
        files.push(SourceFile::new(
            "crates/xsm-a/src/parse.rs",
            "pub fn p() {}",
        ));
        assert_eq!(items(&files), ["xsm_a::parse mod", "xsm_a::parse::p fn"]);
        assert!(list("xsm-a", "crates/xsm-a/src", &lib("pub mod gone;")).is_err());
    }

    #[test]
    fn fails_when_api_grows_or_shrinks() {
        let actual = items(&lib("pub fn a() {} pub fn b() {}"));
        assert!(check("xsm_a::a fn\nxsm_a::b fn\n", &actual).is_empty());
        assert_eq!(check("# note\nxsm_a::a fn\n", &actual).len(), 1);
        assert_eq!(
            check("xsm_a::a fn\nxsm_a::b fn\nxsm_a::c fn\n", &actual).len(),
            1
        );
    }
}
