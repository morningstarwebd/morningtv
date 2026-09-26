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
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) NovaTV/1.0"),
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
        let mut last_err = None;

        while attempts <= retries {
            match self.inner.get(url).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        return resp.text().await.map_err(NetworkError::RequestFailed);
                    } else {
                        last_err = Some(NetworkError::Unreachable(format!(
                            "HTTP Status {}",
                            resp.status()
                        )));
                    }
                }
                Err(err) => {
                    last_err = Some(NetworkError::RequestFailed(err));
                }
            }
            attempts += 1;
            tokio::time::sleep(Duration::from_millis(500 * (1 << attempts))).await;
        }

        Err(last_err.unwrap_or(NetworkError::Timeout(30)))
    }
}
