//! Pure: cutting a stream of bytes into text without splitting a character.

/// How many leading bytes of `buf` can be turned into text now. A character cut off at the end
/// is left for the next read; bytes that can never be text are counted (they become U+FFFD).
#[must_use]
pub fn complete_len(buf: &[u8]) -> usize {
    match std::str::from_utf8(buf) {
        Err(e) if e.error_len().is_none() => e.valid_up_to(),
        _ => buf.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_text_is_complete() {
        assert_eq!(complete_len(b"hello"), 5);
        assert_eq!(complete_len(b""), 0);
    }

    #[test]
    fn a_cut_character_waits() {
        let bytes = "aé".as_bytes();
        assert_eq!(complete_len(&bytes[..2]), 1);
        assert_eq!(complete_len(bytes), 3);
    }

    #[test]
    fn junk_is_passed_on() {
        assert_eq!(complete_len(&[0x61, 0xff, 0x62]), 3);
    }
}
