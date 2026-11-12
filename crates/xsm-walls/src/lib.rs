//! The house rules from `AGENTS.md`, each as a function over the files to check.
//!
//! Every wall takes the files (or text) it checks and returns a list of
//! violations. Unit tests prove each wall fails on a bad sample; the tests in
//! `tests/repo.rs` run every wall over the real repository.
#![deny(missing_docs)]

pub mod bare_numbers;
pub mod block_map;
pub mod copy_paste;
pub mod escape_hatches;
pub mod file_size;
pub mod files;
pub mod front_doors;
pub mod no_personal_data;
pub mod one_home;
pub mod pure_blocks;
pub mod rustsrc;
