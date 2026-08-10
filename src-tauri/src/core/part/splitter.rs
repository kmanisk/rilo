use super::model::DownloadPart;

/// Rilo Dynamic Segment Sizing Table:
/// < 1 MB       -> 1 Segment
/// 1 MB - 10 MB -> 2 Segments
/// 10 - 100 MB  -> 4 Segments
/// 100 MB - 1 GB-> 8 Segments
/// > 1 GB       -> 16 Segments
pub fn calculate_dynamic_segments(total_bytes: u64, user_override: Option<u32>) -> usize {
    if let Some(override_val) = user_override {
        if override_val > 0 {
            return override_val.min(32) as usize;
        }
    }

    const MB: u64 = 1024 * 1024;
    const GB: u64 = 1024 * MB;

    if total_bytes < MB {
        1
    } else if total_bytes < 10 * MB {
        2
    } else if total_bytes < 100 * MB {
        4
    } else if total_bytes < GB {
        8
    } else {
        16
    }
}

pub fn split_into_parts(total_bytes: u64, num_parts: usize) -> Vec<DownloadPart> {
    if total_bytes == 0 || num_parts == 0 {
        return vec![];
    }

    let actual_parts = (num_parts as u64).min(total_bytes) as usize;
    let parts_u64 = actual_parts as u64;
    let part_size = total_bytes / parts_u64;
    let mut parts = Vec::with_capacity(actual_parts);

    for i in 0..actual_parts {
        let start = i as u64 * part_size;
        let end = if i == actual_parts - 1 {
            total_bytes.saturating_sub(1)
        } else {
            ((i as u64 + 1) * part_size).saturating_sub(1)
        };

        parts.push(DownloadPart {
            index: i,
            start_byte: start,
            end_byte: end,
            downloaded_bytes: 0,
        });
    }

    parts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dynamic_segment_calculation() {
        assert_eq!(calculate_dynamic_segments(500 * 1024, None), 1);
        assert_eq!(calculate_dynamic_segments(5 * 1024 * 1024, None), 2);
        assert_eq!(calculate_dynamic_segments(50 * 1024 * 1024, None), 4);
        assert_eq!(calculate_dynamic_segments(500 * 1024 * 1024, None), 8);
        assert_eq!(calculate_dynamic_segments(2 * 1024 * 1024 * 1024, None), 16);
        assert_eq!(calculate_dynamic_segments(50 * 1024 * 1024, Some(16)), 16);
        assert_eq!(calculate_dynamic_segments(50 * 1024 * 1024, Some(64)), 32);
    }

    #[test]
    fn test_split_into_parts_boundaries() {
        let total = 1000u64;
        let parts = split_into_parts(total, 4);

        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0].start_byte, 0);
        assert_eq!(parts[0].end_byte, 249);

        assert_eq!(parts[1].start_byte, 250);
        assert_eq!(parts[1].end_byte, 499);

        assert_eq!(parts[2].start_byte, 500);
        assert_eq!(parts[2].end_byte, 749);

        assert_eq!(parts[3].start_byte, 750);
        assert_eq!(parts[3].end_byte, 999);

        let total_covered: u64 = parts.iter().map(|p| p.expected_size()).sum();
        assert_eq!(total_covered, total);
    }
}
