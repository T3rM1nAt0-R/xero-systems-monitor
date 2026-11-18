//! The terminal behind the Terminal tab: a real shell on a pseudo-terminal per session.
//! `command` and `text` are the pure parts (what to run, how to cut output); `sessions` owns the processes.
#![deny(missing_docs)]

pub mod admin;
pub mod command;
pub mod sessions;
pub mod text;

pub use command::{local, remote, valid_id, Size, Spec};
pub use sessions::Sessions;
