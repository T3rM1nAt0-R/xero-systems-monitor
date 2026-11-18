//! Opening a job on the web. The window may only ask for addresses that start with `https://github.com/`
//! and hold plain path characters; anything else is refused here, whatever the window sends.

/// Every address must start with this.
const SITE: &str = "https://github.com/";

/// True for the site address followed by letters, digits and `. _ - /` only.
fn allowed(url: &str) -> bool {
    url.strip_prefix(SITE).is_some_and(|rest| {
        !rest.is_empty()
            && !rest.split('/').any(|part| part == "..")
            && rest
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-' | b'/'))
    })
}

/// Open the address in the person's browser.
pub fn open(url: &str) -> Result<(), String> {
    if !allowed(url) {
        return Err("only github.com addresses can be opened".to_owned());
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::allowed;

    #[test]
    fn only_plain_site_addresses_pass() {
        assert!(allowed("https://github.com/example/project/pull/7"));
        assert!(allowed("https://github.com/example/project/actions"));
        for bad in [
            "",
            "https://github.com/",
            "http://github.com/a/b",
            "https://github.com.evil.example/a/b",
            "https://github.com/a/b?x=1",
            "https://github.com/a b",
            "https://github.com/a/../b",
            "https://github.com/..",
            "https://github.com/a/b#x",
            "file:///etc/passwd",
            "https://example.com/https://github.com/a",
        ] {
            assert!(!allowed(bad), "{bad}");
        }
    }
}
