// src-tauri/src/network/ai_brain/doctor.rs
// Stream Doctor & Self-Healing Agent with 3-tier Autonomous Permissions

use crate::config::AiPermissionLevel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamHealResult {
    pub channel_name: String,
    pub healed: bool,
    pub new_url: Option<String>,
    pub requires_user_confirmation: bool,
    pub message: String,
}

pub struct StreamDoctor;

impl StreamDoctor {
    /// Evaluates stream failure against user permission level and initiates repair
    pub async fn diagnose_and_heal(
        channel_name: &str,
        permission: AiPermissionLevel,
        custom_sources: &[String],
    ) -> StreamHealResult {
        let clean_name = channel_name.trim();

        match permission {
            AiPermissionLevel::ReadOnly => {
                StreamHealResult {
                    channel_name: clean_name.to_string(),
                    healed: false,
                    new_url: None,
                    requires_user_confirmation: false,
                    message: format!(
                        "Stream Doctor: Playback disruption detected for '{}'. AI Permission is set to Read-Only; database write skipped.",
                        clean_name
                    ),
                }
            }
            AiPermissionLevel::AskPermission => {
                // Discover candidate mirror
                let candidate = super::crawler::StreamCrawler::hunt_channel_stream(clean_name, custom_sources).await;
                match candidate {
                    Some(url) => StreamHealResult {
                        channel_name: clean_name.to_string(),
                        healed: false,
                        new_url: Some(url),
                        requires_user_confirmation: true,
                        message: format!(
                            "Stream Doctor found an active online mirror for '{}'. Please confirm to update the database.",
                            clean_name
                        ),
                    },
                    None => StreamHealResult {
                        channel_name: clean_name.to_string(),
                        healed: false,
                        new_url: None,
                        requires_user_confirmation: false,
                        message: format!(
                            "Stream Doctor searched upstream mirrors but could not find an active stream for '{}'.",
                            clean_name
                        ),
                    },
                }
            }
            AiPermissionLevel::FullAccess => {
                // Fully autonomous repair without requiring confirmation
                let candidate = super::crawler::StreamCrawler::hunt_channel_stream(clean_name, custom_sources).await;
                match candidate {
                    Some(url) => StreamHealResult {
                        channel_name: clean_name.to_string(),
                        healed: true,
                        new_url: Some(url),
                        requires_user_confirmation: false,
                        message: format!(
                            "Stream Doctor autonomously repaired '{}' with an active verified mirror stream!",
                            clean_name
                        ),
                    },
                    None => StreamHealResult {
                        channel_name: clean_name.to_string(),
                        healed: false,
                        new_url: None,
                        requires_user_confirmation: false,
                        message: format!(
                            "Autonomous Stream Doctor: No active mirrors found online for '{}'.",
                            clean_name
                        ),
                    },
                }
            }
        }
    }
}
