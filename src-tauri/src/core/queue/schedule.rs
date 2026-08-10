#[derive(Debug, Clone, Default)]
pub struct QueueScheduleConfig {
    pub auto_start: bool,
    pub max_concurrent_jobs: usize,
}
