// src/domain/channel.rs
// Core domain entity representing a Live TV Channel with fallback URLs support

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChannelId(pub String);

impl ChannelId {
    pub fn new(raw: &str) -> Self {
        Self(raw.to_string())
    }

    pub fn generate_from_url(url: &str, name: &str) -> Self {
        let combined = format!("{}_{}", name.trim(), url.trim());
        let hash = format!("{:x}", md5_hash(combined.as_bytes()));
        Self(hash)
    }
}

// Simple fast non-cryptographic hash for deterministic channel IDs
fn md5_hash(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &byte in bytes {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn default_verified() -> bool {
    false
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Channel {
    pub id: ChannelId,
    pub name: String,
    pub logo: Option<String>,
    pub group: String,
    pub url: String,
    #[serde(default)]
    pub fallback_urls: Vec<String>,
    pub http_user_agent: Option<String>,
    pub http_referrer: Option<String>,
    pub is_favorite: bool,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default = "default_verified")]
    pub is_verified: bool,
}

impl Channel {
    pub fn new(
        name: String,
        logo: Option<String>,
        group: String,
        url: String,
        http_user_agent: Option<String>,
        http_referrer: Option<String>,
    ) -> Self {
        let id = ChannelId::generate_from_url(&url, &name);
        Self {
            id,
            name: name.trim().to_string(),
            logo,
            group: if group.trim().is_empty() {
                "General".to_string()
            } else {
                group.trim().to_string()
            },
            url: url.trim().to_string(),
            fallback_urls: Vec::new(),
            http_user_agent,
            http_referrer,
            is_favorite: false,
            provider: None,
            is_verified: false,
        }
    }

    pub fn with_provider(mut self, provider: Option<String>) -> Self {
        self.provider = provider;
        self
    }

    pub fn matches_query(&self, query: &str) -> bool {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return true;
        }
        self.name.to_lowercase().contains(&q) || self.group.to_lowercase().contains(&q)
    }
}
