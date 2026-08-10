use crate::config::AppConfig;
use crate::core::connection::create_pooled_client;
use crate::core::queue::QueueManager;
use crate::db::Database;
use crate::models::DownloadCommand;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, Semaphore};
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct DownloadManager {
    pub active_downloads: Arc<Mutex<HashMap<String, (mpsc::Sender<DownloadCommand>, CancellationToken)>>>,
    pub semaphore: Arc<Semaphore>,
    pub db: Option<Database>,
    pub http_client: reqwest::Client,
    pub queue_manager: QueueManager,
    pub config: Arc<Mutex<AppConfig>>,
    pub config_path: PathBuf,
}

impl DownloadManager {
    pub fn new(db: Database, mut config: AppConfig, config_path: PathBuf) -> Self {
        config.validate();
        let http_client = create_pooled_client();
        let queue_manager = QueueManager::new(config.download.max_concurrent_downloads as usize);

        Self {
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::clone(&queue_manager.active_semaphore),
            db: Some(db),
            http_client,
            queue_manager,
            config: Arc::new(Mutex::new(config)),
            config_path,
        }
    }

    pub async fn get_config(&self) -> AppConfig {
        let guard = self.config.lock().await;
        guard.clone()
    }

    pub async fn update_config(&self, mut new_config: AppConfig) -> Result<(), String> {
        new_config.validate();
        let save_res = new_config.save_atomic(&self.config_path);

        if save_res.is_ok() {
            let mut guard = self.config.lock().await;
            *guard = new_config.clone();

            // Sync key settings to SQLite database for backwards compatibility & queries
            if let Some(ref db) = self.db {
                let _ = db.save_setting("max_connections", &new_config.download.max_connections_per_download.to_string());
                let _ = db.save_setting("max_concurrent_downloads", &new_config.download.max_concurrent_downloads.to_string());
                let _ = db.save_setting("download_dir", &new_config.download.download_directory);
                let _ = db.save_setting("schedule_enabled", &new_config.scheduler.schedule_enabled.to_string());
                let _ = db.save_setting("schedule_start_time", &new_config.scheduler.start_time);
                let _ = db.save_setting("schedule_stop_time", &new_config.scheduler.stop_time);
                let _ = db.save_setting("post_download_action", &new_config.scheduler.post_download_action);
                let _ = db.save_setting("theme", &new_config.appearance.theme);
                let _ = db.save_setting("accent_color", &new_config.appearance.accent_color);
                let _ = db.save_setting("font_family", &new_config.appearance.font_family);
                let _ = db.save_setting("font_size", &new_config.appearance.font_size);
                let _ = db.save_setting("density", &new_config.appearance.density);
            }
        }

        save_res
    }
}
