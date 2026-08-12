use crate::models::{DownloadRecord, SiteCredential};
pub use dlman_core::DownloadDatabase;
use std::path::Path;
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    pub inner: DownloadDatabase,
}

impl Database {
    pub async fn init<P: AsRef<Path>>(db_path: P) -> Result<Self, String> {
        let inner = DownloadDatabase::new(db_path)
            .await
            .map_err(|e| format!("Failed initializing SQLite database: {}", e))?;
        Ok(Self { inner })
    }

    pub async fn init_in_memory() -> Result<Self, String> {
        let tmp = std::env::temp_dir().join(format!("rilo_db_{}.db", Uuid::new_v4()));
        Self::init(tmp).await
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<DownloadRecord>, String> {
        let parsed_id = match Uuid::parse_str(id) {
            Ok(u) => u,
            Err(_) => return Ok(None),
        };
        match self.inner.load_download(parsed_id).await {
            Ok(Some(d)) => Ok(Some(crate::download::manager::download_to_record(&d))),
            Ok(None) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn get_all(&self) -> Result<Vec<DownloadRecord>, String> {
        match self.inner.load_all_downloads().await {
            Ok(downloads) => Ok(downloads.iter().map(crate::download::manager::download_to_record).collect()),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn save_setting(&self, key: &str, value: &str) -> Result<(), String> {
        self.inner.save_setting(key, value).await.map_err(|e| e.to_string())
    }

    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        self.inner.get_setting(key).await.map_err(|e| e.to_string())
    }

    pub async fn delete(&self, id: &str) -> Result<(), String> {
        let parsed_id = match Uuid::parse_str(id) {
            Ok(u) => u,
            Err(_) => return Ok(()),
        };
        self.inner.delete_download(parsed_id).await.map_err(|e| e.to_string())
    }

    pub async fn get_site_credentials(&self) -> Result<Vec<SiteCredential>, String> {
        match self.inner.load_all_credentials().await {
            Ok(creds) => Ok(creds
                .into_iter()
                .map(|c| SiteCredential {
                    id: c.id.to_string(),
                    domain: c.domain,
                    protocol: c.protocol,
                    username: c.username,
                    password: c.password,
                    enabled: c.enabled,
                    created_at: c.created_at.to_rfc3339(),
                    last_used_at: c.last_used_at.map(|t| t.to_rfc3339()),
                    notes: c.notes,
                })
                .collect()),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn save_site_credential(&self, cred: &SiteCredential) -> Result<(), String> {
        let uuid = Uuid::parse_str(&cred.id).unwrap_or_else(|_| Uuid::new_v4());
        let c = dlman_types::SiteCredential {
            id: uuid,
            domain: cred.domain.clone(),
            protocol: cred.protocol.clone(),
            username: cred.username.clone(),
            password: cred.password.clone(),
            enabled: cred.enabled,
            created_at: chrono::Utc::now(),
            last_used_at: None,
            notes: cred.notes.clone(),
        };
        self.inner.upsert_credential(&c).await.map_err(|e| e.to_string())
    }

    pub async fn delete_site_credential(&self, id: &str) -> Result<(), String> {
        let uuid = Uuid::parse_str(id).map_err(|e| e.to_string())?;
        self.inner.delete_credential(uuid).await.map_err(|e| e.to_string())
    }

    pub async fn find_credential_for_url(&self, url_str: &str) -> Result<Option<SiteCredential>, String> {
        let creds = self.get_site_credentials().await?;
        Ok(creds.into_iter().find(|c| c.matches_url(url_str)))
    }
}
