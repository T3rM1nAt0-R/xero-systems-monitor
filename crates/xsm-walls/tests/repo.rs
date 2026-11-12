//! Runs every wall over the real repository.

use std::path::PathBuf;
use xsm_walls::files::{
    assert_clean, collect, crate_of, ext, is_test_path, read_text, repo_root, SourceFile,
};
use xsm_walls::{
    bare_numbers, block_map, copy_paste, escape_hatches, file_size, front_doors, no_personal_data,
    one_home, pure_blocks,
};

const PURE_BLOCKS: [&str; 2] = ["xsm-core", "xsm-settings"];

fn root() -> PathBuf {
    repo_root()
}

fn is_code(path: &str) -> bool {
    matches!(ext(path), "rs" | "js" | "jsx" | "sh")
}

fn is_text(path: &str) -> bool {
    !matches!(ext(path), "png" | "ico" | "db" | "lock")
}

fn crate_rs(path: &str) -> bool {
    path.starts_with("crates/") && ext(path) == "rs"
}

fn pure_sources() -> Vec<SourceFile> {
    collect(&root(), crate_rs)
        .into_iter()
        .filter(|f| {
            crate_of(&f.path).is_some_and(|c| PURE_BLOCKS.contains(&c)) && !is_test_path(&f.path)
        })
        .collect()
}

#[test]
fn file_size() {
    assert_clean("file_size", &file_size::check(&collect(&root(), is_code)));
}

#[test]
fn block_map() {
    let manifests = collect(&root(), |p| {
        p.starts_with("crates/") && p.ends_with("/Cargo.toml")
    });
    assert_eq!(manifests.len(), 6, "expected six crate manifests");
    let allow = read_text(&root(), "walls/block-map.toml").unwrap();
    assert_clean("block_map", &block_map::check(&allow, &manifests));
}

#[test]
fn pure_blocks() {
    assert_clean("pure_blocks", &pure_blocks::check(&pure_sources()));
}

#[test]
fn front_doors() {
    let files = collect(&root(), crate_rs);
    let mut actual = Vec::new();
    let mut crates: Vec<&str> = files.iter().filter_map(|f| crate_of(&f.path)).collect();
    crates.dedup();
    for name in crates {
        let src = format!("crates/{name}/src");
        match front_doors::list(name, &src, &files) {
            Ok(items) => actual.extend(items),
            Err(errors) => panic!("{}", errors.join("\n")),
        }
    }
    let expected = read_text(&root(), "walls/front-doors.txt").unwrap();
    let problems = front_doors::check(&expected, &actual);
    assert!(
        problems.is_empty(),
        "{}\nactual list:\n{}",
        problems.join("\n"),
        actual.join("\n")
    );
}

#[test]
fn bare_numbers() {
    assert_clean("bare_numbers", &bare_numbers::check(&pure_sources()));
}

#[test]
fn copy_paste() {
    assert_clean(
        "copy_paste",
        &copy_paste::check(&collect(&root(), crate_rs)),
    );
}

#[test]
fn no_personal_data() {
    let files = collect(&root(), is_text);
    assert_clean("no_personal_data", &no_personal_data::check(&files));
}

#[test]
fn escape_hatches() {
    assert_clean(
        "escape_hatches",
        &escape_hatches::check(&collect(&root(), crate_rs)),
    );
}

#[test]
fn one_home() {
    let rules = read_text(&root(), "walls/one-home.txt").unwrap();
    assert_clean(
        "one_home",
        &one_home::check(&rules, &collect(&root(), is_code)),
    );
}
