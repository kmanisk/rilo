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
                    if let Ok(Some(schedule_enabled)) = db.get_setting("schedule_enabled") {
                        if schedule_enabled == "true" {
                            let current_hhmm = get_current_hhmm_local();

                            if let Ok(Some(start_time)) = db.get_setting("schedule_start_time") {
                                if current_hhmm == start_time {
                                    eprintln!("[QUEUE SCHEDULER] Scheduled start time reached ({})!", current_hhmm);
                                }
                            }

                            if let Ok(Some(stop_time)) = db.get_setting("schedule_stop_time") {
                                if current_hhmm == stop_time {
                                    eprintln!("[QUEUE SCHEDULER] Scheduled stop time reached ({})!", current_hhmm);
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
    // Safe local time computation fallback
    let now_secs = now
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let seconds_today = now_secs % 86400;
    let hours = seconds_today / 3600;
    let minutes = (seconds_today % 3600) / 60;
    format!("{:02}:{:02}", hours, minutes)
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
}
