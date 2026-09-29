use crate::domain::Channel;
use crate::error::{PlaylistError, PlaylistResult};
use crate::network::ResilientHttpClient;
use crate::playlist::parser::M3uParser;
use std::fs;
use std::path::{Path, PathBuf};

pub struct PlaylistFetcher {
    client: ResilientHttpClient,
}

impl PlaylistFetcher {
    pub fn new(client: ResilientHttpClient) -> Self {
        Self { client }
    }

    pub fn cache_path() -> PathBuf {
        dirs::data_dir()
            .or_else(dirs::config_dir)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(crate::config::APP_NAME)
            .join("playlist_cache.m3u")
    }

    pub async fn load(&self, source: &str) -> PlaylistResult<Vec<Channel>> {
        let content = if source.starts_with("http://") || source.starts_with("https://") {
            match self.client.fetch_text_with_retry(source, 2).await {
                Ok(text) => {
                    let cache_file = Self::cache_path();
                    if let Some(parent) = cache_file.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::write(&cache_file, &text);
                    text
                }
                Err(e) => {
                    let cache_file = Self::cache_path();
                    if cache_file.exists() {
                        fs::read_to_string(&cache_file)
                            .map_err(|_| PlaylistError::DownloadFailed(e.to_string()))?
                    } else {
                        return Err(PlaylistError::DownloadFailed(e.to_string()));
                    }
                }
            }
        } else {
            let path = Path::new(source);
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if !ext.eq_ignore_ascii_case("m3u") && !ext.eq_ignore_ascii_case("m3u8") {
                return Err(PlaylistError::InvalidFormat);
            }
            if source.contains("..") {
                return Err(PlaylistError::FileNotFound("Path traversal not permitted".to_string()));
            }

            if path.exists() {
                fs::read_to_string(path).map_err(|e| PlaylistError::FileNotFound(e.to_string()))?
            } else {
                let cache_file = Self::cache_path();
                if cache_file.exists() {
                    fs::read_to_string(&cache_file)
                        .map_err(|err| PlaylistError::FileNotFound(err.to_string()))?
                } else {
                    return Err(PlaylistError::FileNotFound(format!(
                        "Playlist not found: {}",
                        source
                    )));
                }
            }
        };

        M3uParser::parse(&content)
    }
}
