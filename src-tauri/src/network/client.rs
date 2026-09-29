// src/network/client.rs
// Resilient HTTP client with retry logic, timeouts, and custom User-Agent headers

use crate::error::{NetworkError, NetworkResult};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct ResilientHttpClient {
    inner: reqwest::Client,
}

impl ResilientHttpClient {
    pub fn new() -> NetworkResult<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) MorningTV/1.0.1"),
        );

        let inner = reqwest::Client::builder()
            .default_headers(headers)
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(60))
            .pool_max_idle_per_host(5)
            .tcp_keepalive(Duration::from_secs(15))
            .build()
            .map_err(NetworkError::RequestFailed)?;

        Ok(Self { inner })
    }

    pub async fn fetch_text_with_retry(&self, url: &str, retries: usize) -> NetworkResult<String> {
        let mut attempts = 0;
        let mut delay = Duration::from_secs(2);
        let mut last_err = None;

        while attempts <= retries {
            tracing::info!(url, attempt = attempts + 1, "Attempting to fetch remote text");
            match self.inner.get(url).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        tracing::info!(url, attempt = attempts + 1, "Remote text fetched successfully");
                        return resp.text().await.map_err(NetworkError::RequestFailed);
                    } else {
                        let status = resp.status();
                        tracing::warn!(url, attempt = attempts + 1, %status, "HTTP error status received");
                        last_err = Some(NetworkError::Unreachable(format!(
                            "HTTP Status {}",
                            status
                        )));
                    }
                }
                Err(err) => {
                    tracing::warn!(url, attempt = attempts + 1, error = %err, "HTTP request failed");
                    last_err = Some(NetworkError::RequestFailed(err));
                }
            }
            attempts += 1;
            if attempts <= retries {
                tracing::info!(url, delay_secs = delay.as_secs(), "Backing off before retry");
                tokio::time::sleep(delay).await;
                delay = delay.saturating_mul(2);
            }
        }

        tracing::error!(url, attempts, "Exhausted all retries for remote text fetch");
        Err(last_err.unwrap_or(NetworkError::Timeout(30)))
    }
}
