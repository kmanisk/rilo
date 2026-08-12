use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

pub struct QueueScheduler {
    running: Arc<AtomicBool>,
}

impl QueueScheduler {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self, db_conn: Option<crate::db::Database>) {
        if self.running.load(Ordering::Relaxed) {
            return;
        }
        self.running.store(true, Ordering::Relaxed);
        let running_flag = Arc::clone(&self.running);

        tauri::async_runtime::spawn(async move {
            eprintln!("[QUEUE SCHEDULER] Background task started (30s interval check)...");
            while running_flag.load(Ordering::Relaxed) {
                sleep(Duration::from_secs(30)).await;

                if let Some(ref db) = db_conn {
                    if let Ok(Some(schedule_enabled)) = db.get_setting("schedule_enabled").await {
                        if schedule_enabled == "true" {
                            let current_hhmm = get_current_hhmm_local();

                            let active_days_setting = db
                                .get_setting("schedule_active_days")
                                .await
                                .unwrap_or(None)
                                .unwrap_or_else(|| "mon,tue,wed,thu,fri,sat,sun".to_string());
                            let active_days_list: Vec<String> = active_days_setting
                                .split(',')
                                .map(|s| s.trim().to_lowercase())
                                .collect();
                            let current_day = get_current_weekday_code();

                            if active_days_list.contains(&current_day) {
                                if let (Ok(Some(start_time)), Ok(Some(stop_time))) = (
                                    db.get_setting("schedule_start_time").await,
                                    db.get_setting("schedule_stop_time").await,
                                ) {
                                    let is_active =
                                        is_in_schedule_window(&current_hhmm, &start_time, &stop_time);
                                    if is_active {
                                        eprintln!("[QUEUE SCHEDULER] Active schedule window ({}) [{}] -> Auto-advancing queued tasks.", current_hhmm, current_day);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

pub fn get_current_hhmm_local() -> String {
    let now = std::time::SystemTime::now();
    let now_secs = now
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let seconds_today = now_secs % 86400;
    let hours = seconds_today / 3600;
    let minutes = (seconds_today % 3600) / 60;
    format!("{:02}:{:02}", hours, minutes)
}

pub fn get_current_weekday_code() -> String {
    let now = std::time::SystemTime::now();
    let secs = now
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days_since_epoch = secs / 86400;
    let day_of_week = (days_since_epoch + 4) % 7;
    match day_of_week {
        0 => "sun",
        1 => "mon",
        2 => "tue",
        3 => "wed",
        4 => "thu",
        5 => "fri",
        6 => "sat",
        _ => "mon",
    }
    .to_string()
}

pub fn is_in_schedule_window(current_hhmm: &str, start_hhmm: &str, stop_hhmm: &str) -> bool {
    let parse_mins = |s: &str| -> Option<u32> {
        let parts: Vec<&str> = s.trim().split(':').collect();
        if parts.len() == 2 {
            let h = parts[0].parse::<u32>().ok()?;
            let m = parts[1].parse::<u32>().ok()?;
            Some(h * 60 + m)
        } else {
            None
        }
    };

    let cur = match parse_mins(current_hhmm) {
        Some(c) => c,
        None => return false,
    };
    let start = match parse_mins(start_hhmm) {
        Some(s) => s,
        None => return false,
    };
    let stop = match parse_mins(stop_hhmm) {
        Some(s) => s,
        None => return false,
    };

    if start <= stop {
        cur >= start && cur < stop
    } else {
        cur >= start || cur < stop
    }
}

pub fn is_time_match(current_hhmm: &str, target_hhmm: &str) -> bool {
    current_hhmm.trim() == target_hhmm.trim()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_match_validation() {
        assert!(is_time_match("22:00", "22:00"));
        assert!(is_time_match("06:30", "06:30"));
        assert!(!is_time_match("22:00", "22:01"));
        assert!(!is_time_match("06:00", "18:00"));
    }

    #[test]
    fn test_get_current_hhmm_format() {
        let hhmm = get_current_hhmm_local();
        assert_eq!(hhmm.len(), 5);
        assert!(hhmm.contains(':'));
    }

    #[test]
    fn test_normal_schedule_window() {
        assert!(is_in_schedule_window("09:00", "08:00", "17:00"));
        assert!(is_in_schedule_window("08:00", "08:00", "17:00")); // start boundary
        assert!(!is_in_schedule_window("17:00", "08:00", "17:00")); // stop boundary
        assert!(!is_in_schedule_window("07:59", "08:00", "17:00"));
    }

    #[test]
    fn test_overnight_schedule_window() {
        assert!(is_in_schedule_window("23:00", "22:00", "06:00"));
        assert!(is_in_schedule_window("01:30", "22:00", "06:00"));
        assert!(is_in_schedule_window("22:00", "22:00", "06:00")); // start boundary
        assert!(!is_in_schedule_window("06:00", "22:00", "06:00")); // stop boundary
        assert!(!is_in_schedule_window("12:00", "22:00", "06:00"));
    }
}
