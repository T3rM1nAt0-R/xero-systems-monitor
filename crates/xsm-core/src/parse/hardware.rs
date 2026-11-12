//! `HW cpu|gpu|os|board text`: names, read when the probe is asked for them.

use crate::reading::Reading;

pub(super) fn line(r: &mut Reading, rest: &str) -> Option<()> {
    let (kind, name) = rest.split_once(' ')?;
    let name = Some(name.trim().to_owned()).filter(|n| !n.is_empty());
    let h = &mut r.hardware;
    match kind {
        "cpu" => h.cpu = name,
        "gpu" => h.gpu = name,
        "os" => h.os = name,
        "board" => h.board = name,
        _ => return None,
    }
    Some(())
}
