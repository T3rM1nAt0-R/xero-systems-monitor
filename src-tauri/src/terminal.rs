//! The Terminal tab's side of the shell: finds what to run for a machine, starts the session and
//! pushes its output to the window as `terminal-output` and `terminal-exit` events.

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use xsm_collector::{Backend, MachineKind};
use xsm_terminal::{Sessions, Size, Spec};

/// Event with a chunk of output for one session.
const OUTPUT_EVENT: &str = "terminal-output";
/// Event sent once when a session's process has ended.
const EXIT_EVENT: &str = "terminal-exit";

/// The open terminal sessions (ended when the app quits).
#[derive(Default)]
pub struct Terminals(pub Sessions);

#[derive(Clone, Serialize)]
struct Chunk {
    id: String,
    data: String,
}

#[derive(Clone, Serialize)]
struct Ended {
    id: String,
}

/// What to run for `machine`: the local shell for this PC, `ssh -t` to the configured host for a Linux machine.
fn spec_for(backend: &dyn Backend, machine: &str) -> Result<Spec, String> {
    let list = backend.get_machines()?;
    let m = list
        .machines
        .iter()
        .find(|m| m.name == machine)
        .ok_or("That machine is not in the list.")?;
    match m.kind {
        MachineKind::Local => Ok(xsm_terminal::local(
            std::env::var("SHELL").ok().as_deref(),
            cfg!(windows),
        )),
        MachineKind::Ssh => xsm_terminal::remote(m.host.as_deref().unwrap_or("")),
    }
}

/// Start session `id` for `machine`.
pub fn open(
    app: &AppHandle,
    backend: &dyn Backend,
    terms: &Terminals,
    id: &str,
    machine: &str,
    size: Size,
) -> Result<(), String> {
    let spec = spec_for(backend, machine)?;
    let (out, done) = (app.clone(), app.clone());
    let (data_id, exit_id) = (id.to_owned(), id.to_owned());
    terms.0.open(
        id,
        &spec,
        size,
        move |data| {
            let chunk = Chunk {
                id: data_id.clone(),
                data,
            };
            let _ = out.emit(OUTPUT_EVENT, chunk);
        },
        move || {
            let _ = done.emit(EXIT_EVENT, Ended { id: exit_id });
        },
    )
}
