//! Which process owns each open TCP connection and UDP socket on this PC (Windows only).
//! The Windows call is tiny and only fills a buffer; reading it is `xsm_core::connections`.

/// Owning process ids of every TCP connection (not listeners) and UDP socket, one id per row.
/// Empty when this is not Windows or a table could not be read.
pub(crate) fn open_pids() -> Vec<u32> {
    imp::tables()
        .into_iter()
        .flat_map(|(bytes, row)| xsm_core::connections::pids_in_table(&bytes, row))
        .collect()
}

#[cfg(not(windows))]
mod imp {
    /// No connection tables off Windows.
    pub(super) fn tables() -> Vec<(Vec<u8>, usize)> {
        Vec::new()
    }
}

#[cfg(windows)]
mod imp {
    use core::ffi::c_void;
    use windows::Win32::NetworkManagement::IpHelper::{
        GetExtendedTcpTable, GetExtendedUdpTable, TCP_TABLE_OWNER_PID_CONNECTIONS,
        UDP_TABLE_OWNER_PID,
    };
    use xsm_core::connections::{TCP4_ROW, TCP6_ROW, UDP4_ROW, UDP6_ROW};

    /// Address family numbers of the two tables each protocol has.
    const AF_INET: u32 = 2;
    const AF_INET6: u32 = 23;
    /// What the call answers: done, or "the buffer is too small, here is the size".
    const NO_ERROR: u32 = 0;
    const INSUFFICIENT_BUFFER: u32 = 122;
    /// The tables can grow between the size question and the answer, so ask a few times.
    const TRIES: usize = 4;

    /// The four tables as `(bytes, row size)`.
    pub(super) fn tables() -> Vec<(Vec<u8>, usize)> {
        vec![
            (tcp(AF_INET), TCP4_ROW),
            (tcp(AF_INET6), TCP6_ROW),
            (udp(AF_INET), UDP4_ROW),
            (udp(AF_INET6), UDP6_ROW),
        ]
    }

    fn tcp(family: u32) -> Vec<u8> {
        fill_buffer(|buf, size| {
            // reason: the call writes at most `*size` bytes into `buf`, which `fill_buffer` sized and keeps alive for the call
            #[allow(unsafe_code)]
            unsafe {
                GetExtendedTcpTable(buf, size, false, family, TCP_TABLE_OWNER_PID_CONNECTIONS, 0)
            }
        })
    }

    fn udp(family: u32) -> Vec<u8> {
        fill_buffer(|buf, size| {
            // reason: the call writes at most `*size` bytes into `buf`, which `fill_buffer` sized and keeps alive for the call
            #[allow(unsafe_code)]
            unsafe {
                GetExtendedUdpTable(buf, size, false, family, UDP_TABLE_OWNER_PID, 0)
            }
        })
    }

    /// Run `call` until it fills a buffer: the first call (no buffer) says how big, the next ones fill.
    /// The buffer is made of 4-byte words because the table is laid out in them.
    fn fill_buffer(call: impl Fn(Option<*mut c_void>, *mut u32) -> u32) -> Vec<u8> {
        let mut size = 0_u32;
        let mut words: Vec<u32> = Vec::new();
        for _ in 0..TRIES {
            let buf = (!words.is_empty()).then(|| words.as_mut_ptr().cast::<c_void>());
            match call(buf, &raw mut size) {
                NO_ERROR => {
                    let have = usize::try_from(size).unwrap_or(0);
                    return words
                        .iter()
                        .flat_map(|w| w.to_le_bytes())
                        .take(have)
                        .collect();
                }
                INSUFFICIENT_BUFFER => {
                    words = vec![0; usize::try_from(size).unwrap_or(0).div_ceil(4)];
                }
                _ => break,
            }
        }
        Vec::new()
    }
}
