#[derive(Debug, Clone)]
pub struct DownloadPart {
    pub index: usize,
    pub start_byte: u64,
    pub end_byte: u64,
    pub downloaded_bytes: u64,
}

impl DownloadPart {
    pub fn expected_size(&self) -> u64 {
        self.end_byte.saturating_sub(self.start_byte) + 1
    }

    pub fn is_completed(&self) -> bool {
        self.downloaded_bytes >= self.expected_size()
    }
}
