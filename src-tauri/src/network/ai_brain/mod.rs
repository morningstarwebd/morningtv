// src-tauri/src/network/ai_brain/mod.rs
// MorningTV Universal AI Neural Engine: Modular Architecture & Autonomous Agents

pub mod crawler;
pub mod doctor;
pub mod epg;
pub mod fallback;
pub mod providers;
pub mod scheduler;
pub mod vibe;

pub use crawler::DiscoveredChannel;
pub use doctor::StreamHealResult;
pub use providers::{AiModelItem, ProviderDetectionResult};
pub use scheduler::ScheduleTimerAction;

use crate::config::AiPermissionLevel;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    max_tokens: u32,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat<'a>>,
}

#[derive(Serialize)]
struct ResponseFormat<'a> {
    #[serde(rename = "type")]
    format_type: &'a str,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryItem {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiContext {
    pub current_channel: Option<String>,
    pub current_volume: i64,
    pub is_muted: bool,
    pub active_category: String,
    pub channel_sample: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatResponse {
    pub reply: String,
    pub action: Option<String>,
    pub param: Option<String>,
}

pub struct AiBrain;

impl AiBrain {
    // Re-exports to ProviderManager
    pub fn infer_provider_config(key: &str, custom_endpoint: Option<&str>) -> (String, String, String) {
        providers::ProviderManager::infer_provider_config(key, custom_endpoint)
    }

    pub fn get_provider_config(
        preferred_provider: Option<&str>,
        key: &str,
        custom_endpoint: Option<&str>,
    ) -> (String, String, String) {
        providers::ProviderManager::get_provider_config(preferred_provider, key, custom_endpoint)
    }

    pub async fn fetch_provider_models(
        provider_name: &str,
        api_key: Option<&str>,
        custom_endpoint: Option<&str>,
    ) -> Vec<AiModelItem> {
        providers::ProviderManager::fetch_provider_models(provider_name, api_key, custom_endpoint).await
    }

    pub async fn detect_and_verify(
        api_key: &str,
        custom_endpoint: Option<&str>,
        preferred_provider: Option<&str>,
        preferred_model: Option<&str>,
    ) -> Result<ProviderDetectionResult, String> {
        providers::ProviderManager::detect_and_verify(api_key, custom_endpoint, preferred_provider, preferred_model).await
    }

    pub async fn test_connection(api_key: &str) -> Result<String, String> {
        providers::ProviderManager::test_connection(api_key).await
    }

    pub async fn smart_channel_match(
        api_key: &str,
        target_name: &str,
        candidates: &[String],
    ) -> Result<Option<String>, String> {
        providers::ProviderManager::smart_channel_match(api_key, target_name, candidates).await
    }

    // Re-exports to StreamCrawler
    pub async fn autonomous_stream_hunt(channel_name: &str, custom_sources: &[String]) -> Option<String> {
        crawler::StreamCrawler::hunt_channel_stream(channel_name, custom_sources).await
    }

    pub async fn deep_hunt(channel_name: &str, custom_sources: &[String]) -> crawler::DeepHuntReport {
        crawler::StreamCrawler::deep_hunt(channel_name, custom_sources).await
    }

    pub fn extract_channel_target(msg: &str) -> Option<String> {
        crawler::StreamCrawler::extract_channel_target(msg)
    }

    pub fn extract_custom_stream_intent(msg: &str) -> Option<(String, String)> {
        crawler::StreamCrawler::extract_custom_stream_intent(msg)
    }

    pub async fn autonomous_channel_discovery(
        channel_name: &str,
        custom_sources: &[String],
    ) -> Option<DiscoveredChannel> {
        crawler::StreamCrawler::discover_channel(channel_name, custom_sources).await
    }

    // Re-exports to StreamDoctor
    pub async fn diagnose_and_heal_stream(
        channel_name: &str,
        permission: AiPermissionLevel,
        custom_sources: &[String],
    ) -> StreamHealResult {
        doctor::StreamDoctor::diagnose_and_heal(channel_name, permission, custom_sources).await
    }

    // Re-exports to FallbackIntentEngine
    pub fn local_fallback_intent(msg: &str, context: &AiContext) -> AiChatResponse {
        fallback::FallbackIntentEngine::local_fallback_intent(msg, context)
    }

    pub fn infer_action_from_interaction(
        ai_text: &str,
        user_query: &str,
        context: &AiContext,
    ) -> (Option<String>, Option<String>) {
        fallback::FallbackIntentEngine::infer_action_from_interaction(ai_text, user_query, context)
    }

    // Re-exports to EpgIntelligence
    pub fn query_epg(user_query: &str, current_channel: Option<&str>, sample_channels: &[String]) -> (Option<String>, String) {
        epg::EpgIntelligence::query_schedule(user_query, current_channel, sample_channels)
    }

    // Re-exports to SchedulerAgent
    pub fn parse_schedule_intent(msg: &str) -> Option<ScheduleTimerAction> {
        scheduler::SchedulerAgent::parse_schedule_intent(msg)
    }

    // Re-exports to VibeClassifier
    pub fn recommend_by_vibe(user_query: &str, sample_channels: &[String]) -> Option<(String, String)> {
        vibe::VibeClassifier::recommend_by_vibe(user_query, sample_channels)
    }

    /// Legacy ask assistant method
    pub async fn ask_assistant(
        api_key: &str,
        user_query: &str,
        context: &str,
    ) -> Result<String, String> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err("AI API key not configured".to_string());
        }

        let (provider, endpoint, model) = Self::infer_provider_config(key, None);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
            .map_err(|e| e.to_string())?;

        let prompt = format!(
            "Channel Context:\n{}\n\nUser Question: {}\n\nProvide a friendly, concise answer guiding the user to the best channels or programs available.",
            context, user_query
        );

        let request = ChatCompletionRequest {
            model: &model,
            messages: vec![
                ChatMessage {
                    role: "system",
                    content: "You are MorningTV AI Assistant. You help users find live TV channels, sports events, movies, and news broadcasts. Default language: English.",
                },
                ChatMessage {
                    role: "user",
                    content: &prompt,
                },
            ],
            max_tokens: 250,
            temperature: 0.5,
            response_format: None,
        };

        let response = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to reach {provider} API: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("{provider} AI error ({status}): {err_text}"));
        }

        let body: ChatCompletionResponse = response.json().await.map_err(|e| e.to_string())?;
        if let Some(choice) = body.choices.first() {
            Ok(choice.message.content.clone())
        } else {
            Err("Empty response from AI Brain".to_string())
        }
    }

    /// Interactive Voice & Chat Copilot with multi-provider routing, tools execution & multi-turn memory
    pub async fn chat_with_copilot(
        api_key: Option<&str>,
        custom_endpoint: Option<&str>,
        preferred_provider: Option<&str>,
        preferred_model: Option<&str>,
        user_message: &str,
        history: Option<&[ChatHistoryItem]>,
        context: &AiContext,
    ) -> Result<AiChatResponse, String> {
        let msg = user_message.trim();
        if msg.is_empty() {
            return Ok(AiChatResponse {
                reply: "No input received. Please speak or type your request.".to_string(),
                action: None,
                param: None,
            });
        }

        // If an API key is provided, route directly to the LLM Brain with conversation history
        if let Some(key) = api_key {
            let clean_key = key.trim();
            if !clean_key.is_empty() {
                let (provider, endpoint, default_model) =
                    Self::get_provider_config(preferred_provider, clean_key, custom_endpoint);
                let model = preferred_model
                    .filter(|m| !m.trim().is_empty())
                    .unwrap_or(&default_model);

                let system_prompt = format!(
                    "You are MorningTV Copilot, the AI brain of the MorningTV Windows application.\n\
                    Current Status: Channel={:?}, Volume={}%, Muted={}, Category={}.\n\
                    Sample Library Channels: {}\n\n\
                    Capabilities and Available Application Tools:\n\
                    1. 'play_channel': Plays any TV channel from the user's library (10,000+ channels). Always resolve phonetic spellings, typos, and abbreviations to the canonical channel name (e.g., 'hugama'/'hungama' -> 'Hungama', 'zee bangla' -> 'Zee Bangla HD', 'jalsha' -> 'Star Jalsha', 'sony ten' -> 'Sony Sports Ten 1 HD').\n\
                    2. 'hunt_stream': Autonomous stream hunter & healer. If a channel is missing, lost, broken, expired, or unavailable, hunt internet mirrors and update the local database.\n\
                    3. 'set_volume': Changes volume (0 to 100%).\n\
                    4. 'toggle_mute': Toggles mute status.\n\
                    5. 'set_category': Filters channels by category ('News', 'Sports', 'Movies', 'Entertainment', 'Kids', 'Music', 'India', 'All').\n\
                    6. 'toggle_fullscreen': Enters or exits fullscreen playback.\n\
                    7. 'sleep_timer': Schedules sleep timer to stop playback after specified minutes (e.g. 30).\n\
                    8. 'schedule_channel': Schedules an auto-tune switch to a specific channel.\n\n\
                    LANGUAGE & PERSONALITY:\n\
                    - You are fully multilingual. Understand ANY language, dialect, or phonetic slang (English, Bengali, Hindi, Banglish, Hinglish).\n\
                    - Reply in the same language and style the user uses (if Bengali/Banglish, reply in Bengali; if English, reply in English).\n\
                    - If the user asks what tools or powers you have, describe your capabilities (channel switching, auto stream healing into database, volume/mute, category filtering, sleep timers) naturally and helpfully.\n\n\
                    RESPONSE FORMAT:\n\
                    Respond in valid JSON:\n\
                    {{\n\
                      \"reply\": \"<Your friendly, intelligent response in user's language>\",\n\
                      \"action\": \"play_channel\" | \"hunt_stream\" | \"set_volume\" | \"toggle_mute\" | \"set_category\" | \"toggle_fullscreen\" | \"sleep_timer\" | \"schedule_channel\" | null,\n\
                      \"param\": \"<channel name, volume number, category name, delay minutes, or null>\"\n\
                    }}",
                    context.current_channel,
                    context.current_volume,
                    context.is_muted,
                    context.active_category,
                    context.channel_sample.iter().take(30).cloned().collect::<Vec<_>>().join(", ")
                );

                let client = match reqwest::Client::builder()
                    .timeout(Duration::from_secs(20))
                    .build()
                {
                    Ok(c) => c,
                    Err(e) => return Err(e.to_string()),
                };

                let mut messages_payload = Vec::new();
                messages_payload.push(ChatMessage {
                    role: "system",
                    content: &system_prompt,
                });

                if let Some(hist) = history {
                    for item in hist.iter().take(10) {
                        messages_payload.push(ChatMessage {
                            role: if item.role == "user" { "user" } else { "assistant" },
                            content: &item.content,
                        });
                    }
                }

                messages_payload.push(ChatMessage {
                    role: "user",
                    content: msg,
                });

                let request = ChatCompletionRequest {
                    model: model,
                    messages: messages_payload,
                    max_tokens: 450,
                    temperature: 0.3,
                    response_format: None,
                };

                match client
                    .post(&endpoint)
                    .header("Authorization", format!("Bearer {}", clean_key))
                    .header("Content-Type", "application/json")
                    .json(&request)
                    .send()
                    .await
                {
                    Ok(resp) => {
                        let status = resp.status();
                        if status.is_success() {
                            if let Ok(body) = resp.json::<ChatCompletionResponse>().await {
                                if let Some(choice) = body.choices.first() {
                                    let parsed = Self::parse_copilot_response(&choice.message.content, msg, context);
                                    return Ok(parsed);
                                }
                            }
                        } else {
                            let err_text = resp.text().await.unwrap_or_default();
                            tracing::warn!("{provider} API error ({status}): {err_text}");
                            return Ok(AiChatResponse {
                                reply: format!("⚠️ {provider} Error ({status}): {err_text}"),
                                action: None,
                                param: None,
                            });
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to reach {provider} API: {e}");
                        return Ok(AiChatResponse {
                            reply: format!("⚠️ Network error connecting to {provider}: {e}"),
                            action: None,
                            param: None,
                        });
                    }
                }
            }
        }

        // Fallback: Local rule-based intent parsing (works 100% offline without any API key)
        Ok(Self::local_fallback_intent(msg, context))
    }

    /// Extracts JSON action/reply or gracefully treats conversational text as natural response
    pub fn parse_copilot_response(content: &str, user_query: &str, context: &AiContext) -> AiChatResponse {
        let trimmed = content.trim();

        // 1. Direct JSON parse
        if let Ok(parsed) = serde_json::from_str::<AiChatResponse>(trimmed) {
            if !parsed.reply.trim().is_empty() {
                return parsed;
            }
        }

        // 2. Extract JSON embedded inside markdown code blocks or arbitrary text
        if let Some(start) = trimmed.find('{') {
            if let Some(end) = trimmed.rfind('}') {
                if end > start {
                    let json_slice = &trimmed[start..=end];
                    if let Ok(parsed) = serde_json::from_str::<AiChatResponse>(json_slice) {
                        if !parsed.reply.trim().is_empty() {
                            return parsed;
                        }
                    }
                }
            }
        }

        // 3. Natural conversational text from the LLM
        let clean = trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let (action, param) = Self::infer_action_from_interaction(clean, user_query, context);

        AiChatResponse {
            reply: clean.to_string(),
            action,
            param,
        }
    }
}
