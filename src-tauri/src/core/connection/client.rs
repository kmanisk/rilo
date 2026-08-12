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

pub fn create_client_with_config(config: &crate::config::DownloadConfig) -> reqwest::Client {
    let mut default_headers = reqwest::header::HeaderMap::new();
    default_headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("*/*"),
    );
    default_headers.insert(
        reqwest::header::ACCEPT_LANGUAGE,
        reqwest::header::HeaderValue::from_static("en-US,en;q=0.9"),
    );

    let user_agent = if !config.default_user_agent.trim().is_empty() {
        config.default_user_agent.trim().to_string()
    } else {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string()
    };

    let timeout_secs = config.connection_timeout_seconds.clamp(5, 300) as u64;

    let mut builder = reqwest::Client::builder()
        .user_agent(user_agent)
        .connect_timeout(Duration::from_secs(timeout_secs))
        .timeout(Duration::from_secs(timeout_secs * 4))
        .pool_max_idle_per_host(32)
        .tcp_nodelay(true)
        .danger_accept_invalid_certs(config.ignore_ssl_certificates)
        .redirect(reqwest::redirect::Policy::limited(10))
        .default_headers(default_headers);

    if config.proxy.mode == "none" {
        builder = builder.no_proxy();
    } else if config.proxy.mode == "manual" {
        if let Some(ref http_url) = config.proxy.http_proxy {
            if !http_url.trim().is_empty() {
                if let Ok(mut p) = reqwest::Proxy::all(http_url.trim()) {
                    if let (Some(u), Some(pass)) = (&config.proxy.username, &config.proxy.password) {
                        p = p.basic_auth(u, pass);
                    }
                    builder = builder.proxy(p);
                }
            }
        }
    }

    builder.build().unwrap_or_else(|_| create_pooled_client())
}

pub fn should_bypass_proxy(host: &str, no_proxy: &str) -> bool {
    let host_lower = host.trim().to_lowercase();
    for pattern in no_proxy.split(',') {
        let pat = pattern.trim().to_lowercase();
        if pat.is_empty() {
            continue;
        }
        if pat == "localhost" || pat == "127.0.0.1" {
            if host_lower == "localhost" || host_lower == "127.0.0.1" || host_lower == "::1" {
                return true;
            }
        }
        if pat.starts_with("*.") {
            let suffix = &pat[2..];
            if host_lower == suffix || host_lower.ends_with(&format!(".{}", suffix)) {
                return true;
            }
        } else if pat.starts_with('.') {
            if host_lower.ends_with(&pat) || host_lower == &pat[1..] {
                return true;
            }
        } else if host_lower == pat || host_lower.ends_with(&format!(".{}", pat)) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_bypass_rules() {
        let no_proxy = "localhost, 127.0.0.1, *.local, internal.example.com";
        assert!(should_bypass_proxy("localhost", no_proxy));
        assert!(should_bypass_proxy("127.0.0.1", no_proxy));
        assert!(should_bypass_proxy("dev.local", no_proxy));
        assert!(should_bypass_proxy("internal.example.com", no_proxy));
        assert!(!should_bypass_proxy("example.com", no_proxy));
        assert!(!should_bypass_proxy("google.com", no_proxy));
    }
}
