use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: u32,
    pub download: DownloadConfig,
    pub scheduler: SchedulerConfig,
    #[serde(default)]
    pub browser: Option<BrowserConfig>,
    pub appearance: AppearanceConfig,
}

fn default_connection_timeout() -> u32 {
    30
}

fn default_proxy_mode() -> String {
    "system".to_string()
}

fn default_active_days() -> Vec<String> {
    vec![
        "mon".to_string(),
        "tue".to_string(),
        "wed".to_string(),
        "thu".to_string(),
        "fri".to_string(),
        "sat".to_string(),
        "sun".to_string(),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyConfig {
    #[serde(default = "default_proxy_mode")]
    pub mode: String,
    #[serde(default)]
    pub http_proxy: Option<String>,
    #[serde(default)]
    pub https_proxy: Option<String>,
    #[serde(default)]
    pub no_proxy: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadConfig {
    pub download_directory: String,
    pub max_concurrent_downloads: u32,
    pub max_connections_per_download: u32,
    pub retry_count: u32,
    pub retry_delay_seconds: u32,
    #[serde(default = "default_connection_timeout")]
    pub connection_timeout_seconds: u32,
    pub global_speed_limit_kbps: u64,
    pub auto_start: bool,
    #[serde(default)]
    pub auto_extract_archives: bool,
    #[serde(default)]
    pub delete_archive_after_extraction: bool,
    #[serde(default)]
    pub use_category_by_default: bool,
    #[serde(default)]
    pub ignore_ssl_certificates: bool,
    #[serde(default)]
    pub default_user_agent: String,
    #[serde(default)]
    pub append_extension_incomplete: bool,
    #[serde(default)]
    pub check_disk_space: bool,
    #[serde(default)]
    pub proxy: ProxyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerConfig {
    pub schedule_enabled: bool,
    pub start_time: String,
    pub stop_time: String,
    #[serde(default = "default_active_days")]
    pub active_days: Vec<String>,
    pub post_download_action: String,
    #[serde(default)]
    pub custom_command: String,
}

fn default_true() -> bool {
    true
}

fn default_mode() -> String {
    "system".to_string()
}

fn default_language() -> String {
    "system".to_string()
}

fn default_ui_scale() -> String {
    "system".to_string()
}

fn default_browser_port() -> u16 {
    15151
}

fn default_browser_api_key() -> String {
    "VNrFjwyVENqcnGnBCVtiYjw1".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_browser_port")]
    pub port: u16,
    #[serde(default)]
    pub use_api_key: bool,
    #[serde(default = "default_browser_api_key")]
    pub api_key: String,
}

impl Default for BrowserConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            port: 15151,
            use_api_key: false,
            api_key: "VNrFjwyVENqcnGnBCVtiYjw1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    pub theme: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub default_dark_theme: Option<String>,
    #[serde(default)]
    pub default_light_theme: Option<String>,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_ui_scale")]
    pub ui_scale: String,
    #[serde(default = "default_true")]
    pub compact_top_bar: bool,
    #[serde(default = "default_true")]
    pub show_icon_labels: bool,
    #[serde(default = "default_true")]
    pub use_relative_date_time: bool,
    #[serde(default = "default_true")]
    pub start_on_boot: bool,
    #[serde(default = "default_true")]
    pub use_system_tray: bool,
    #[serde(default)]
    pub download_size_unit: Option<String>,
    #[serde(default)]
    pub download_speed_unit: Option<String>,
    #[serde(default)]
    pub show_average_speed: Option<bool>,
    #[serde(default)]
    pub notification_sound: Option<bool>,
    #[serde(default)]
    pub show_download_progress_dialog: Option<bool>,
    #[serde(default)]
    pub show_download_completion_dialog: Option<bool>,
    #[serde(default)]
    pub render_api: Option<String>,
    pub accent_color: String,
    pub font_family: String,
    pub font_size: String,
    pub font_size_px: u32,
    pub density: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: 1,
            download: DownloadConfig::default(),
            scheduler: SchedulerConfig::default(),
            browser: Some(BrowserConfig::default()),
            appearance: AppearanceConfig::default(),
        }
    }
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            download_directory: String::new(),
            max_concurrent_downloads: 4,
            max_connections_per_download: 8,
            retry_count: 3,
            retry_delay_seconds: 5,
            connection_timeout_seconds: 30,
            global_speed_limit_kbps: 0,
            auto_start: false,
            auto_extract_archives: false,
            delete_archive_after_extraction: false,
            use_category_by_default: false,
            ignore_ssl_certificates: false,
            default_user_agent: String::new(),
            append_extension_incomplete: false,
            check_disk_space: true,
            proxy: ProxyConfig::default(),
        }
    }
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            schedule_enabled: false,
            start_time: "22:00".to_string(),
            stop_time: "06:00".to_string(),
            active_days: default_active_days(),
            post_download_action: "none".to_string(),
            custom_command: String::new(),
        }
    }
}

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            theme: "rilo-default".to_string(),
            mode: "system".to_string(),
            default_dark_theme: Some("rilo-default".to_string()),
            default_light_theme: Some("github-light".to_string()),
            language: "system".to_string(),
            ui_scale: "system".to_string(),
            compact_top_bar: true,
            show_icon_labels: true,
            use_relative_date_time: true,
            start_on_boot: true,
            use_system_tray: true,
            download_size_unit: None,
            download_speed_unit: None,
            show_average_speed: None,
            notification_sound: None,
            show_download_progress_dialog: None,
            show_download_completion_dialog: None,
            render_api: None,
            accent_color: "indigo".to_string(),
            font_family: "Inter".to_string(),
            font_size: "Default".to_string(),
            font_size_px: 15,
            density: "Comfortable".to_string(),
        }
    }
}

impl AppConfig {
    /// Validates all configuration settings and clamps values within safe operational bounds.
    pub fn validate(&mut self) {
        self.version = 1;

        // Download Config Validation
        self.download.max_concurrent_downloads = self.download.max_concurrent_downloads.clamp(1, 16);
        self.download.max_connections_per_download = self.download.max_connections_per_download.clamp(1, 32);
        self.download.retry_count = self.download.retry_count.clamp(0, 10);
        self.download.retry_delay_seconds = self.download.retry_delay_seconds.clamp(1, 60);
        self.download.connection_timeout_seconds = self.download.connection_timeout_seconds.clamp(5, 300);

        // Scheduler Validation
        if !validate_hhmm(&self.scheduler.start_time) {
            self.scheduler.start_time = "22:00".to_string();
        }
        if !validate_hhmm(&self.scheduler.stop_time) {
            self.scheduler.stop_time = "06:00".to_string();
        }

        let valid_actions = ["none", "notify", "sleep", "shutdown", "hibernate", "command"];
        if !valid_actions.contains(&self.scheduler.post_download_action.as_str()) {
            self.scheduler.post_download_action = "none".to_string();
        }

        // Appearance Validation
        if self.appearance.theme.is_empty() || self.appearance.theme == "dark" {
            self.appearance.theme = "rilo-default".to_string();
        } else if self.appearance.theme == "light" {
            self.appearance.theme = "github-light".to_string();
        }

        let valid_modes = ["system", "dark", "light"];
        if !valid_modes.contains(&self.appearance.mode.to_lowercase().as_str()) {
            self.appearance.mode = "system".to_string();
        }

        let valid_accents = ["indigo", "blue", "purple", "emerald", "green", "orange", "rose", "red"];
        if !valid_accents.contains(&self.appearance.accent_color.to_lowercase().as_str()) {
            self.appearance.accent_color = "indigo".to_string();
        }

        let valid_fonts = ["Inter", "Geist", "IBM Plex Sans", "JetBrains Mono", "Iosevka", "Roboto", "System"];
        if !valid_fonts.contains(&self.appearance.font_family.as_str()) {
            self.appearance.font_family = "Inter".to_string();
        }

        let valid_sizes = ["Small", "Default", "Large"];
        if !valid_sizes.contains(&self.appearance.font_size.as_str()) {
            self.appearance.font_size = "Default".to_string();
        }

        if self.appearance.font_size_px == 0 {
            self.appearance.font_size_px = 15;
        }
        self.appearance.font_size_px = self.appearance.font_size_px.clamp(12, 20);

        let valid_densities = ["compact", "comfortable", "spacious", "Compact", "Comfortable", "Spacious"];
        if !valid_densities.contains(&self.appearance.density.as_str()) {
            self.appearance.density = "comfortable".to_string();
        }
    }

    /// Loads configuration from the given file path.
    /// If missing or malformed, logs error, applies safe defaults, and saves a fresh config.
    pub fn load_or_create(config_path: &Path) -> Self {
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        if config_path.exists() {
            match fs::read_to_string(config_path) {
                Ok(content) => match serde_json::from_str::<AppConfig>(&content) {
                    Ok(mut config) => {
                        config.validate();
                        return config;
                    }
                    Err(e) => {
                        eprintln!(
                            "[CONFIG WARNING] Failed parsing {:?}: {}. Falling back to defaults.",
                            config_path, e
                        );
                    }
                },
                Err(e) => {
                    eprintln!(
                        "[CONFIG WARNING] Failed reading {:?}: {}. Falling back to defaults.",
                        config_path, e
                    );
                }
            }
        }

        let mut default_config = AppConfig::default();
        default_config.validate();
        let _ = default_config.save_atomic(config_path);
        default_config
    }

    /// Atomic write to prevent file corruption on crash:
    /// Writes to config.json.tmp, flushes, and renames atomically to target path.
    pub fn save_atomic(&self, config_path: &Path) -> Result<(), String> {
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let tmp_path = config_path.with_extension("tmp");
        let json_data = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed serializing config: {}", e))?;

        fs::write(&tmp_path, json_data)
            .map_err(|e| format!("Failed writing temporary config file: {}", e))?;

        fs::rename(&tmp_path, config_path)
            .map_err(|e| format!("Failed atomic config replacement: {}", e))?;

        Ok(())
    }
}

fn validate_hhmm(val: &str) -> bool {
    let parts: Vec<&str> = val.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let h: u32 = match parts[0].parse() {
        Ok(v) => v,
        Err(_) => return false,
    };
    let m: u32 = match parts[1].parse() {
        Ok(v) => v,
        Err(_) => return false,
    };
    h < 24 && m < 60
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_config_default_validation() {
        let mut config = AppConfig::default();
        config.validate();

        assert_eq!(config.version, 1);
        assert_eq!(config.download.max_concurrent_downloads, 4);
        assert_eq!(config.download.max_connections_per_download, 8);
        assert_eq!(config.appearance.theme, "rilo-default");
        assert_eq!(config.appearance.font_family, "Inter");
        assert_eq!(config.appearance.font_size_px, 15);
    }

    #[test]
    fn test_config_validation_clamping() {
        let mut config = AppConfig::default();
        config.download.max_concurrent_downloads = 999;
        config.download.max_connections_per_download = 0;
        config.download.retry_count = 100;
        config.scheduler.start_time = "invalid_time".to_string();
        config.appearance.theme = "".to_string();
        config.appearance.font_size_px = 50;

        config.validate();

        assert_eq!(config.download.max_concurrent_downloads, 16);
        assert_eq!(config.download.max_connections_per_download, 1);
        assert_eq!(config.download.retry_count, 10);
        assert_eq!(config.scheduler.start_time, "22:00");
        assert_eq!(config.appearance.theme, "rilo-default");
        assert_eq!(config.appearance.font_size_px, 20);
    }

    #[test]
    fn test_config_atomic_write_and_reload() {
        let temp_dir = std::env::temp_dir().join("downloader_config_test");
        let _ = fs::create_dir_all(&temp_dir);
        let config_file = temp_dir.join("config.json");

        let mut original = AppConfig::default();
        original.download.max_concurrent_downloads = 8;
        original.appearance.accent_color = "purple".to_string();
        original.appearance.font_size_px = 16;

        original.save_atomic(&config_file).expect("Atomic save failed");
        assert!(config_file.exists());

        let loaded = AppConfig::load_or_create(&config_file);
        assert_eq!(loaded.download.max_concurrent_downloads, 8);
        assert_eq!(loaded.appearance.accent_color, "purple");
        assert_eq!(loaded.appearance.font_size_px, 16);

        let _ = fs::remove_dir_all(temp_dir);
    }
}
