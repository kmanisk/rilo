use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct QueueManager {
    pub active_semaphore: Arc<Semaphore>,
}

impl QueueManager {
    pub fn new(max_concurrent_downloads: usize) -> Self {
        Self {
            active_semaphore: Arc::new(Semaphore::new(max_concurrent_downloads)),
        }
    }
}
