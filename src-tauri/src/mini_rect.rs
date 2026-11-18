//! The mini window's sums, kept apart from the window calls so they can be tested.
//!
//! Windows and Tauri speak about two sizes: the *outer* size (with the frame and its shadow) and the *inner* size
//! (the web page). `set_size` sets the inner one, so every sum here is done on the inner size and the frame is the
//! fixed difference between the two. Mixing them makes a window creep by the frame on every resize.

/// One axis of the window: where the outer edge starts and how long the outer and inner extents are, in screen pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Axis {
    /// Start of the outer edge (left or top).
    pub pos: i32,
    /// Outer extent, frame included.
    pub outer: u32,
    /// Inner extent, the web page only.
    pub inner: u32,
}

/// The part of the screen the window may use along one axis (the work area, less the corner gap).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Room {
    /// Start of the usable space.
    pub start: i32,
    /// Length of the usable space.
    pub len: u32,
}

/// Where the outer edge should start once the inner extent becomes `new_inner`: the far (right or bottom) edge stays
/// where it is, and the window is pushed back inside `room` only when it would otherwise hang off the screen.
#[must_use]
pub fn anchored_start(axis: Axis, new_inner: u32, room: Option<Room>) -> i32 {
    let frame = i64::from(axis.outer) - i64::from(axis.inner);
    let new_outer = frame + i64::from(new_inner);
    let far = i64::from(axis.pos) + i64::from(axis.outer);
    let mut start = far - new_outer;
    if let Some(r) = room {
        let end = i64::from(r.start) + i64::from(r.len);
        start = start.min(end - new_outer).max(i64::from(r.start));
    }
    i32::try_from(start).unwrap_or(axis.pos)
}

/// The biggest inner extent that still fits `room` with the frame around it.
#[must_use]
pub fn max_inner(axis: Axis, room: Option<Room>) -> u32 {
    room.map_or(u32::MAX, |r| {
        r.len.saturating_sub(axis.outer.saturating_sub(axis.inner))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const AX: Axis = Axis {
        pos: 1000,
        outer: 320,
        inner: 300,
    };
    const ROOM: Room = Room {
        start: 0,
        len: 1080,
    };

    #[test]
    fn keeps_the_far_edge_by_inner_difference() {
        // growing the inner extent by 100 moves the start back by 100, not by 100 plus the frame
        assert_eq!(anchored_start(AX, 400, None), 900);
        assert_eq!(anchored_start(AX, 300, None), 1000);
        assert_eq!(anchored_start(AX, 200, None), 1100);
    }

    #[test]
    fn repeating_the_same_size_never_moves() {
        let mut ax = AX;
        for _ in 0..5 {
            let start = anchored_start(ax, 400, Some(ROOM));
            ax = Axis {
                pos: start,
                outer: 420,
                inner: 400,
            };
        }
        assert_eq!(ax.pos, 660);
        assert_eq!(anchored_start(ax, 400, Some(ROOM)), 660);
    }

    #[test]
    fn stays_on_the_screen() {
        assert_eq!(anchored_start(AX, 1200, Some(ROOM)), 0);
        let low = Axis {
            pos: -50,
            outer: 320,
            inner: 300,
        };
        assert_eq!(anchored_start(low, 300, Some(ROOM)), 0);
        let off = Axis {
            pos: 900,
            outer: 320,
            inner: 300,
        };
        assert_eq!(anchored_start(off, 300, Some(ROOM)), 760);
    }

    #[test]
    fn biggest_inner_leaves_room_for_the_frame() {
        assert_eq!(max_inner(AX, Some(ROOM)), 1060);
        assert_eq!(max_inner(AX, None), u32::MAX);
    }
}
