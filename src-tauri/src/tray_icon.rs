//! The tray icon's status dot: the program icon with a coloured dot in its bottom-right corner.
//! Drawn from the icon's own pixels, so no extra image files are needed.

/// How calm the machines are, as the window decides it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    /// Everything is fine (green dot).
    Calm,
    /// Something needs a look (amber dot).
    Look,
    /// A machine is offline or a job or container failed (red dot).
    Bad,
}

/// Dot colours, the same green, amber and red the window uses.
const GREEN: [u8; 3] = [0x4a, 0xde, 0x80];
const AMBER: [u8; 3] = [0xfb, 0xbf, 0x24];
const RED: [u8; 3] = [0xfb, 0x5a, 0x72];
/// The dark ring around the dot, so it shows on light and dark task bars.
const RING: [u8; 3] = [0x12, 0x15, 0x1c];

impl Status {
    /// `calm`, `look` or `bad`; anything else is not a status.
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "calm" => Some(Self::Calm),
            "look" => Some(Self::Look),
            "bad" => Some(Self::Bad),
            _ => None,
        }
    }

    fn rgb(self) -> [u8; 3] {
        match self {
            Self::Calm => GREEN,
            Self::Look => AMBER,
            Self::Bad => RED,
        }
    }
}

/// Copy of `rgba` (`width` x `height`, 4 bytes a pixel) with the status dot drawn on it.
/// The dot's width is a quarter of the icon's, centred a quarter in from the corner.
pub fn with_dot(rgba: &[u8], width: usize, status: Status) -> Vec<u8> {
    with_pulse(rgba, width, status, 0)
}

/// Like [`with_dot`], with the dot `grow` pixels bigger all round: the frames of the "something went red" pulse.
pub fn with_pulse(rgba: &[u8], width: usize, status: Status, grow: usize) -> Vec<u8> {
    let mut out = rgba.to_vec();
    if width == 0 {
        return out;
    }
    let outer = width / 4 + grow;
    let inner = outer.saturating_sub((width / 16).max(1));
    let centre = width - outer;
    for (i, px) in out.chunks_exact_mut(4).enumerate() {
        let (x, y) = (i % width, i / width);
        let (dx, dy) = (x.abs_diff(centre), y.abs_diff(centre));
        let d2 = dx * dx + dy * dy;
        let rgb = if d2 <= inner * inner {
            status.rgb()
        } else if d2 <= outer * outer {
            RING
        } else {
            continue;
        };
        px.copy_from_slice(&[rgb[0], rgb[1], rgb[2], u8::MAX]);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn statuses_parse_and_others_do_not() {
        assert_eq!(Status::parse("calm"), Some(Status::Calm));
        assert_eq!(Status::parse("look"), Some(Status::Look));
        assert_eq!(Status::parse("bad"), Some(Status::Bad));
        assert_eq!(Status::parse("green"), None);
    }

    #[test]
    fn the_dot_is_in_the_corner_and_the_rest_is_untouched() {
        let size = 32;
        let base = vec![7_u8; size * size * 4];
        for (status, rgb) in [
            (Status::Calm, GREEN),
            (Status::Look, AMBER),
            (Status::Bad, RED),
        ] {
            let out = with_dot(&base, size, status);
            let at = |x: usize, y: usize| out[(y * size + x) * 4..][..4].to_vec();
            assert_eq!(at(24, 24), [rgb[0], rgb[1], rgb[2], u8::MAX]);
            assert_eq!(at(24, 17)[..3], RING, "ring above the dot");
            assert_eq!(at(0, 0), [7, 7, 7, 7]);
        }
        assert_eq!(with_dot(&[], 0, Status::Calm), Vec::<u8>::new());
    }

    #[test]
    fn a_pulse_frame_has_a_bigger_dot() {
        let size = 32;
        let base = vec![7_u8; size * size * 4];
        let (plain, big) = (
            with_dot(&base, size, Status::Bad),
            with_pulse(&base, size, Status::Bad, 3),
        );
        let touched = |v: &[u8]| v.chunks_exact(4).filter(|p| p[..3] != [7, 7, 7]).count();
        assert!(touched(&big) > touched(&plain));
        assert_eq!(with_pulse(&base, size, Status::Bad, 0), plain);
    }
}
