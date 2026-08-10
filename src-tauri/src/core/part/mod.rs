pub mod model;
pub mod splitter;
pub mod worker;

pub use model::DownloadPart;
pub use splitter::{calculate_dynamic_segments, split_into_parts};
pub use worker::run_part_worker;
