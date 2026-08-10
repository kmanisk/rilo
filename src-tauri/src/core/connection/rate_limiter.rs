use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct RateLimiter {
    is_unlimited: Arc<AtomicBool>,
    state: Arc<Mutex<RateLimiterState>>,
}

struct RateLimiterState {
    capacity: u64,
    tokens: f64,
    last_refill: Instant,
    refill_rate: u64,
    window_bytes: u64,
    window_start: Instant,
}

impl RateLimiter {
    pub fn new(bytes_per_second: u64) -> Self {
        if bytes_per_second == 0 {
            return Self::unlimited();
        }
        let capacity = bytes_per_second;
        Self {
            is_unlimited: Arc::new(AtomicBool::new(false)),
            state: Arc::new(Mutex::new(RateLimiterState {
                capacity,
                tokens: capacity as f64,
                last_refill: Instant::now(),
                refill_rate: bytes_per_second,
                window_bytes: 0,
                window_start: Instant::now(),
            })),
        }
    }

    pub fn unlimited() -> Self {
        Self {
            is_unlimited: Arc::new(AtomicBool::new(true)),
            state: Arc::new(Mutex::new(RateLimiterState {
                capacity: u64::MAX,
                tokens: f64::MAX,
                last_refill: Instant::now(),
                refill_rate: u64::MAX,
                window_bytes: 0,
                window_start: Instant::now(),
            })),
        }
    }

    pub async fn set_limit(&self, bytes_per_second: u64) {
        if bytes_per_second == 0 || bytes_per_second == u64::MAX {
            self.is_unlimited.store(true, Ordering::Relaxed);
            let mut state = self.state.lock().await;
            state.capacity = u64::MAX;
            state.refill_rate = u64::MAX;
            state.tokens = f64::MAX;
        } else {
            self.is_unlimited.store(false, Ordering::Relaxed);
            let mut state = self.state.lock().await;
            state.capacity = bytes_per_second;
            state.refill_rate = bytes_per_second;
            state.tokens = state.tokens.min(bytes_per_second as f64);
        }
    }

    pub async fn acquire(&self, bytes: u64) {
        // Fast path for unlimited: zero lock contention across parallel workers!
        if self.is_unlimited.load(Ordering::Relaxed) {
            return;
        }

        let bytes_to_acquire = bytes.min(16384);

        loop {
            let wait_time = {
                let mut state = self.state.lock().await;
                if self.is_unlimited.load(Ordering::Relaxed) {
                    return;
                }
                self.refill_tokens(&mut state);

                if state.tokens >= bytes_to_acquire as f64 {
                    state.tokens -= bytes_to_acquire as f64;
                    state.window_bytes += bytes_to_acquire;
                    return;
                }

                let needed = bytes_to_acquire as f64 - state.tokens;
                let wait_secs = needed / state.refill_rate as f64;
                Duration::from_secs_f64(wait_secs.min(0.05))
            };

            if wait_time > Duration::ZERO {
                tokio::time::sleep(wait_time).await;
            }
        }
    }

    fn refill_tokens(&self, state: &mut RateLimiterState) {
        let now = Instant::now();
        let elapsed = now.duration_since(state.last_refill);
        let elapsed_secs = elapsed.as_secs_f64();

        if elapsed_secs > 0.001 {
            let new_tokens = elapsed_secs * state.refill_rate as f64;
            state.tokens = (state.tokens + new_tokens).min(state.capacity as f64);
            state.last_refill = now;
        }

        if now.duration_since(state.window_start).as_secs() >= 1 {
            state.window_bytes = 0;
            state.window_start = now;
        }
    }
}
