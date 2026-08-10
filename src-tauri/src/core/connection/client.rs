use std::time::Duration;

pub fn create_pooled_client() -> reqwest::Client {
    let mut default_headers = reqwest::header::HeaderMap::new();
    default_headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("*/*"),
    );
    default_headers.insert(
        reqwest::header::ACCEPT_LANGUAGE,
        reqwest::header::HeaderValue::from_static("en-US,en;q=0.9"),
    );

    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(120))
        .pool_max_idle_per_host(32)
        .tcp_nodelay(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .default_headers(default_headers)
        .build()
        .expect("Failed to create pooled reqwest client")
}
