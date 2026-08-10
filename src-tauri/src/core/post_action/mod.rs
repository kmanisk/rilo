use std::process::Command;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PostDownloadAction {
    None,
    Notify,
    Sleep,
    Shutdown,
    Hibernate,
    RunCommand(String),
}

impl PostDownloadAction {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "notify" => PostDownloadAction::Notify,
            "sleep" => PostDownloadAction::Sleep,
            "shutdown" => PostDownloadAction::Shutdown,
            "hibernate" => PostDownloadAction::Hibernate,
            other if other.starts_with("run:") => {
                PostDownloadAction::RunCommand(other.trim_start_matches("run:").to_string())
            }
            _ => PostDownloadAction::None,
        }
    }

    pub fn execute(&self) {
        match self {
            PostDownloadAction::None => {}
            PostDownloadAction::Notify => {
                eprintln!("[POST ACTION] Download completed notification.");
            }
            PostDownloadAction::Sleep => {
                eprintln!("[POST ACTION] Triggering System Sleep...");
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("rundll32.exe")
                        .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                        .spawn();
                }
            }
            PostDownloadAction::Shutdown => {
                eprintln!("[POST ACTION] Triggering System Shutdown in 30s...");
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("shutdown")
                        .args(["/s", "/t", "30"])
                        .spawn();
                }
            }
            PostDownloadAction::Hibernate => {
                eprintln!("[POST ACTION] Triggering System Hibernate...");
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("shutdown")
                        .args(["/h"])
                        .spawn();
                }
            }
            PostDownloadAction::RunCommand(cmd_str) => {
                eprintln!("[POST ACTION] Running custom command: {}", cmd_str);
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("cmd")
                        .args(["/C", cmd_str])
                        .spawn();
                }
            }
        }
    }
}
