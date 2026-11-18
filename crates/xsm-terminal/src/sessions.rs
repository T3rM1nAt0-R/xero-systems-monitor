//! The processes: one pseudo-terminal per session id. The only place a shell or ssh is started for the window.

use crate::command::{valid_id, Size, Spec};
use crate::text::complete_len;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Mutex, MutexGuard};
use std::thread;

/// Bytes read from the terminal at a time.
const READ_CHUNK: usize = 8192;

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

impl Session {
    fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// The open sessions, keyed by id. Dropping it ends every one of them.
#[derive(Default)]
pub struct Sessions {
    map: Mutex<HashMap<String, Session>>,
}

fn pty_size(size: Size) -> PtySize {
    PtySize {
        rows: size.rows,
        cols: size.cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn spawn(spec: &Spec, size: Size) -> Result<(Session, Box<dyn Read + Send>), String> {
    let pair = native_pty_system()
        .openpty(pty_size(size))
        .map_err(|e| e.to_string())?;
    let start = |program: &str| {
        let mut cmd = CommandBuilder::new(program);
        cmd.args(&spec.args);
        pair.slave.spawn_command(cmd)
    };
    let child = match start(&spec.program) {
        Ok(c) => c,
        Err(first) => match &spec.fallback {
            Some(other) => start(other).map_err(|e| e.to_string())?,
            None => return Err(first.to_string()),
        },
    };
    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    Ok((
        Session {
            master: pair.master,
            writer,
            child,
        },
        reader,
    ))
}

impl Sessions {
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Session>> {
        self.map
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    /// Start `spec` as session `id`. `on_data` gets the output as text; `on_exit` runs once when it ends.
    ///
    /// # Errors
    /// A message when the id is not valid or already open, or the program cannot start.
    pub fn open(
        &self,
        id: &str,
        spec: &Spec,
        size: Size,
        on_data: impl Fn(String) + Send + 'static,
        on_exit: impl FnOnce() + Send + 'static,
    ) -> Result<(), String> {
        if !valid_id(id) {
            return Err("That is not a terminal id.".to_owned());
        }
        if self.lock().contains_key(id) {
            return Err("That terminal is already open.".to_owned());
        }
        let (session, mut reader) = spawn(spec, size)?;
        self.lock().insert(id.to_owned(), session);
        thread::spawn(move || {
            let (mut buf, mut held) = (vec![0u8; READ_CHUNK], Vec::new());
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 {
                    break;
                }
                held.extend_from_slice(&buf[..n]);
                let ready = complete_len(&held);
                if ready > 0 {
                    on_data(String::from_utf8_lossy(&held[..ready]).into_owned());
                    held.drain(..ready);
                }
            }
            on_exit();
        });
        Ok(())
    }

    /// Send keystrokes to session `id`.
    ///
    /// # Errors
    /// A message when there is no such session or the write fails.
    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut map = self.lock();
        let s = map.get_mut(id).ok_or("That terminal is closed.")?;
        s.writer
            .write_all(data.as_bytes())
            .and_then(|()| s.writer.flush())
            .map_err(|e| e.to_string())
    }

    /// Tell session `id` its window changed size.
    ///
    /// # Errors
    /// A message when there is no such session or the resize fails.
    pub fn resize(&self, id: &str, size: Size) -> Result<(), String> {
        let map = self.lock();
        let s = map.get(id).ok_or("That terminal is closed.")?;
        s.master.resize(pty_size(size)).map_err(|e| e.to_string())
    }

    /// End session `id` and its process. Closing one that is already gone is fine.
    pub fn close(&self, id: &str) {
        let gone = self.lock().remove(id);
        if let Some(mut s) = gone {
            s.kill();
        }
    }

    /// End every session (the app is quitting).
    pub fn close_all(&self) {
        let all: Vec<Session> = self.lock().drain().map(|(_, s)| s).collect();
        for mut s in all {
            s.kill();
        }
    }
}

impl Drop for Sessions {
    fn drop(&mut self) {
        self.close_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::sync::mpsc;
    #[cfg(unix)]
    use std::time::Duration;

    #[cfg(unix)]
    fn sh() -> Spec {
        Spec {
            program: "sh".into(),
            args: Vec::new(),
            fallback: None,
        }
    }

    #[cfg(unix)]
    #[test]
    fn runs_a_shell_and_closes_it() {
        let sessions = Sessions::default();
        let (tx, rx) = mpsc::channel();
        let size = Size::new(80, 24);
        let send = move |s| {
            let _ = tx.send(s);
        };
        sessions.open("t1", &sh(), size, send, || {}).unwrap();
        sessions.write("t1", "echo xsm-$((6*7))\n").unwrap();
        sessions.resize("t1", Size::new(100, 30)).unwrap();
        let mut seen = String::new();
        while !seen.contains("xsm-42") {
            seen += &rx.recv_timeout(Duration::from_secs(10)).unwrap();
        }
        assert!(sessions.open("t1", &sh(), size, |_| {}, || {}).is_err());
        sessions.close("t1");
        assert!(sessions.write("t1", "x").is_err());
        sessions.close("t1");
    }

    #[cfg(unix)]
    #[test]
    fn refuses_bad_ids_and_missing_programs() {
        let sessions = Sessions::default();
        let size = Size::new(80, 24);
        let missing = Spec {
            program: "xsm-no-such-program".into(),
            ..sh()
        };
        assert!(sessions.open("a b", &sh(), size, |_| {}, || {}).is_err());
        assert!(sessions.open("ok", &missing, size, |_| {}, || {}).is_err());
        assert!(sessions.resize("none", size).is_err());
    }
}
