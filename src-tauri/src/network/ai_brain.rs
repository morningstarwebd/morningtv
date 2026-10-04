// src/network/ai_brain.rs
// MorningTV Universal AI Neural Engine: Multi-Provider Auto-Detection, Low-Latency Model Routing, Voice Copilot & Autonomous Stream Healing

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

#[derive(Deserialize)]
struct ModelsListResponse {
    #[serde(default)]
    data: Vec<ModelItem>,
}

#[derive(Deserialize)]
struct ModelItem {
    id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDetectionResult {
    pub success: bool,
    pub provider_name: String,
    pub active_model: String,
    pub available_models: Vec<String>,
    pub latency_ms: u128,
    pub endpoint: String,
    pub message: String,
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
    /// Inspects API key signature and auto-detects provider, endpoint, and default model
    pub fn infer_provider_config(key: &str, custom_endpoint: Option<&str>) -> (String, String, String) {
        let clean = key.trim();

        if let Some(custom) = custom_endpoint {
            let ep = custom.trim();
            if !ep.is_empty() {
                let base = ep.trim_end_matches('/');
                let chat_url = if base.ends_with("/chat/completions") {
                    base.to_string()
                } else {
                    format!("{}/chat/completions", base)
                };
                return ("Custom / Local Provider".to_string(), chat_url, "default".to_string());
            }
        }

        if clean.starts_with("gsk_") {
            (
                "Groq LPU".to_string(),
                "https://api.groq.com/openai/v1/chat/completions".to_string(),
                "llama-3.3-70b-versatile".to_string(),
            )
        } else if clean.starts_with("sk-proj-") || clean.starts_with("sk-admin-") || (clean.starts_with("sk-") && clean.len() > 40 && !clean.starts_with("sk-or-") && !clean.starts_with("sk-ant-")) {
            (
                "OpenAI".to_string(),
                "https://api.openai.com/v1/chat/completions".to_string(),
                "gpt-4o-mini".to_string(),
            )
        } else if clean.starts_with("AIzaSy") {
            (
                "Google Gemini".to_string(),
                "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions".to_string(),
                "gemini-1.5-flash".to_string(),
            )
        } else if clean.starts_with("sk-or-v1-") || clean.starts_with("sk-or-") {
            (
                "OpenRouter".to_string(),
                "https://openrouter.ai/api/v1/chat/completions".to_string(),
                "meta-llama/llama-3.3-70b-instruct".to_string(),
            )
        } else if clean.starts_with("dsk-") || clean.contains("deepseek") {
            (
                "DeepSeek".to_string(),
                "https://api.deepseek.com/chat/completions".to_string(),
                "deepseek-chat".to_string(),
            )
        } else if clean.starts_with("pplx-") {
            (
                "Perplexity AI".to_string(),
                "https://api.perplexity.ai/chat/completions".to_string(),
                "sonar".to_string(),
            )
        } else if clean.starts_with("nvapi-") {
            (
                "NVIDIA NIM".to_string(),
                "https://integrate.api.nvidia.com/v1/chat/completions".to_string(),
                "meta/llama-3.3-70b-instruct".to_string(),
            )
        } else if clean.starts_with("sk-ant-") {
            (
                "Anthropic Claude".to_string(),
                "https://api.anthropic.com/v1/messages".to_string(),
                "claude-3-5-sonnet-20241022".to_string(),
            )
        } else {
            // Default fallback assumption: OpenAI compatible
            (
                "Universal AI Provider".to_string(),
                "https://api.groq.com/openai/v1/chat/completions".to_string(),
                "llama-3.3-70b-versatile".to_string(),
            )
        }
    }

    /// Automatically validates API Key across all supported providers, queries available models, and returns latency
    pub async fn detect_and_verify(
        api_key: &str,
        custom_endpoint: Option<&str>,
    ) -> Result<ProviderDetectionResult, String> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err("API key is empty".to_string());
        }

        let (provider_name, endpoint, default_model) = Self::infer_provider_config(key, custom_endpoint);
        let start = std::time::Instant::now();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .map_err(|e| e.to_string())?;

        // 1. Try to fetch available models list from provider models endpoint
        let mut available_models = Vec::new();
        let models_endpoint = if endpoint.contains("/chat/completions") {
            endpoint.replace("/chat/completions", "/models")
        } else {
            format!("{}/models", endpoint.trim_end_matches('/'))
        };

        if let Ok(resp) = client
            .get(&models_endpoint)
            .header("Authorization", format!("Bearer {}", key))
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(list) = resp.json::<ModelsListResponse>().await {
                    for m in list.data.into_iter().take(20) {
                        available_models.push(m.id);
                    }
                }
            }
        }

        // 2. Perform lightweight test completion to verify authorization
        let request = ChatCompletionRequest {
            model: &default_model,
            messages: vec![ChatMessage {
                role: "user",
                content: "ping",
            }],
            max_tokens: 5,
            temperature: 0.1,
            response_format: None,
        };

        let response = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to reach {provider_name} API: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("{provider_name} error ({status}): {err_text}"));
        }

        let latency_ms = start.elapsed().as_millis();
        let message = format!(
            "Successfully connected to {} in {}ms (Active Model: {})",
            provider_name, latency_ms, default_model
        );

        Ok(ProviderDetectionResult {
            success: true,
            provider_name,
            active_model: default_model,
            available_models,
            latency_ms,
            endpoint,
            message,
        })
    }

    /// Legacy compatibility wrapper for test_connection
    pub async fn test_connection(api_key: &str) -> Result<String, String> {
        let res = Self::detect_and_verify(api_key, None).await?;
        Ok(res.message)
    }

    /// Resolves obscure or malformed channel names using the configured AI provider
    pub async fn smart_channel_match(
        api_key: &str,
        target_name: &str,
        candidates: &[String],
    ) -> Result<Option<String>, String> {
        let key = api_key.trim();
        if key.is_empty() || candidates.is_empty() {
            return Ok(None);
        }

        let (_provider, endpoint, model) = Self::infer_provider_config(key, None);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        let candidate_list = candidates
            .iter()
            .take(30)
            .enumerate()
            .map(|(i, c)| format!("{}. {}", i + 1, c))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
            "Target TV Channel: \"{}\"\n\nCandidate Stream Names:\n{}\n\nWhich numbered candidate represents the SAME channel as the target? Output ONLY the exact matching candidate name, or 'NONE' if no genuine match exists. Do not explain.",
            target_name, candidate_list
        );

        let request = ChatCompletionRequest {
            model: &model,
            messages: vec![
                ChatMessage {
                    role: "system",
                    content: "You are an expert TV broadcast identifier. Match regional and satellite channel titles accurately.",
                },
                ChatMessage {
                    role: "user",
                    content: &prompt,
                },
            ],
            max_tokens: 30,
            temperature: 0.0,
            response_format: None,
        };

        let response = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let body: ChatCompletionResponse = response.json().await.map_err(|e| e.to_string())?;
        if let Some(choice) = body.choices.first() {
            let answer = choice.message.content.trim();
            if answer.to_uppercase() != "NONE" && !answer.is_empty() {
                for c in candidates {
                    if answer.contains(c.as_str()) || c.contains(answer) {
                        return Ok(Some(c.clone()));
                    }
                }
            }
        }

        Ok(None)
    }

    /// Conversational TV guide assistant
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

    /// Interactive Voice & Chat Copilot with multi-provider routing and action execution (English default, multilingual responsive)
    pub async fn chat_with_copilot(
        api_key: Option<&str>,
        custom_endpoint: Option<&str>,
        user_message: &str,
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

        // If an API key is provided, use the inferred AI provider with structured JSON mode
        if let Some(key) = api_key {
            let clean_key = key.trim();
            if !clean_key.is_empty() {
                let (_provider, endpoint, model) = Self::infer_provider_config(clean_key, custom_endpoint);

                let system_prompt = format!(
                    "You are MorningTV Voice AI Co-Pilot, an intelligent assistant inside the MorningTV Windows application.\n\
                    Current Status: Channel={:?}, Volume={}%, Muted={}, Category={}.\n\
                    Sample Available Channels: {}\n\n\
                    Default Language: English. If user speaks in Bengali, reply in Bengali. If user speaks in Hindi, reply in Hindi.\n\n\
                    You MUST respond in valid JSON with schema:\n\
                    {{\n\
                      \"reply\": \"<natural friendly response in the user's language>\",\n\
                      \"action\": \"play_channel\" | \"set_volume\" | \"toggle_mute\" | \"hunt_stream\" | \"set_category\" | \"toggle_fullscreen\" | null,\n\
                      \"param\": \"<channel name, volume number, category name, or null>\"\n\
                    }}\n\
                    Rules:\n\
                    - If user asks to play, switch, or watch a channel (e.g. 'Play Zee Bangla', 'জি বাংলা চালাও', 'switch to sports'), set action to 'play_channel' and param to the best channel name.\n\
                    - If user asks to change volume (e.g. 'volume 40%', 'সাউন্ড কমাও', 'set volume to 80'), set action to 'set_volume' and param to the target percentage (0-100).\n\
                    - If user asks to mute/unmute ('mute', 'শব্দ বন্ধ করো', 'unmute'), set action to 'toggle_mute'.\n\
                    - If user says a channel is broken, link expired, or needs stream recovery ('Zee Bangla not working find stream', 'লিংক উদ্ধার করো'), set action to 'hunt_stream' and param to channel name.\n\
                    - If user asks to filter a category ('show movies', 'স্পোর্টস চ্যানেল দেখাও'), set action to 'set_category' and param to ('News'|'Sports'|'Movies'|'Entertainment'|'Kids'|'Music'|'India'|'All').\n\
                    - Keep reply concise and helpful (1-2 sentences).",
                    context.current_channel,
                    context.current_volume,
                    context.is_muted,
                    context.active_category,
                    context.channel_sample.iter().take(30).cloned().collect::<Vec<_>>().join(", ")
                );

                let client = reqwest::Client::builder()
                    .timeout(Duration::from_secs(8))
                    .build()
                    .map_err(|e| e.to_string())?;

                let request = ChatCompletionRequest {
                    model: &model,
                    messages: vec![
                        ChatMessage {
                            role: "system",
                            content: &system_prompt,
                        },
                        ChatMessage {
                            role: "user",
                            content: msg,
                        },
                    ],
                    max_tokens: 220,
                    temperature: 0.3,
                    response_format: Some(ResponseFormat {
                        format_type: "json_object",
                    }),
                };

                if let Ok(resp) = client
                    .post(&endpoint)
                    .header("Authorization", format!("Bearer {}", clean_key))
                    .header("Content-Type", "application/json")
                    .json(&request)
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(body) = resp.json::<ChatCompletionResponse>().await {
                            if let Some(choice) = body.choices.first() {
                                if let Ok(parsed) = serde_json::from_str::<AiChatResponse>(&choice.message.content) {
                                    return Ok(parsed);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fallback: Local rule-based intent parsing (works 100% offline without any API key)
        Ok(Self::local_fallback_intent(msg, context))
    }

    /// Smart local intent parser when offline or no API key configured (English default, bilingual Bengali)
    fn local_fallback_intent(msg: &str, context: &AiContext) -> AiChatResponse {
        let lower = msg.to_lowercase();
        let is_bengali = msg.chars().any(|c| ('\u{0980}'..='\u{09FF}').contains(&c));

        // 1. Mute / Unmute
        if lower.contains("mute") || lower.contains("মিউট") || lower.contains("শব্দ বন্ধ") {
            let next_mute = !context.is_muted;
            return AiChatResponse {
                reply: if is_bengali {
                    if next_mute { "সাউন্ড মিউট করা হয়েছে।" } else { "সাউন্ড আনমিউট করা হয়েছে।" }.to_string()
                } else {
                    if next_mute { "Audio has been muted." } else { "Audio has been unmuted." }.to_string()
                },
                action: Some("toggle_mute".to_string()),
                param: None,
            };
        }

        // 2. Volume control
        if lower.contains("volume") || lower.contains("সাউন্ড") || lower.contains("sound") || lower.contains("আওয়াজ") {
            let digits: String = lower.chars().filter(|c| c.is_ascii_digit()).collect();
            if let Ok(num) = digits.parse::<i64>() {
                let clamped = num.clamp(0, 100);
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("ভলিউম {}% এ সেট করা হলো।", clamped)
                    } else {
                        format!("Volume set to {}%.", clamped)
                    },
                    action: Some("set_volume".to_string()),
                    param: Some(clamped.to_string()),
                };
            }

            if lower.contains("up") || lower.contains("বাড়া") || lower.contains("high") || lower.contains("increase") {
                let target = (context.current_volume + 15).min(100);
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("ভলিউম বাড়িয়ে {}% করা হলো।", target)
                    } else {
                        format!("Increased volume to {}%.", target)
                    },
                    action: Some("set_volume".to_string()),
                    param: Some(target.to_string()),
                };
            }

            if lower.contains("down") || lower.contains("কমা") || lower.contains("low") || lower.contains("decrease") {
                let target = (context.current_volume - 15).max(0);
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("ভলিউম কমিয়ে {}% করা হলো।", target)
                    } else {
                        format!("Reduced volume to {}%.", target)
                    },
                    action: Some("set_volume".to_string()),
                    param: Some(target.to_string()),
                };
            }
        }

        // 3. Fullscreen
        if lower.contains("fullscreen") || lower.contains("ফুলস্ক্রিন") || lower.contains("ফুল স্ক্রিন") {
            return AiChatResponse {
                reply: if is_bengali {
                    "ফুলস্ক্রিন মোড টগল করা হলো।".to_string()
                } else {
                    "Toggled fullscreen mode.".to_string()
                },
                action: Some("toggle_fullscreen".to_string()),
                param: None,
            };
        }

        // 4. Broken Stream Hunt / Healing
        if lower.contains("খুঁজে") || lower.contains("hunt") || lower.contains("heal") || lower.contains("fix") || lower.contains("not working") || lower.contains("কাজ করছে না") || lower.contains("চলছে না") {
            for ch in &context.channel_sample {
                let norm_ch = ch.to_lowercase();
                if lower.contains(&norm_ch) || (norm_ch.len() > 3 && lower.contains(&norm_ch[..norm_ch.len().min(6)])) {
                    return AiChatResponse {
                        reply: if is_bengali {
                            format!("ইন্টারনেট ও ব্যাকআপ থেকে {} এর লাইভ স্ট্রিম সন্ধান করা হচ্ছে...", ch)
                        } else {
                            format!("Searching internet & upstream mirrors to recover {}...", ch)
                        },
                        action: Some("hunt_stream".to_string()),
                        param: Some(ch.clone()),
                    };
                }
            }
            if let Some(ref cur) = context.current_channel {
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("ইন্টারনেট থেকে {} এর নতুন লাইভ স্ট্রিম খোঁজা হচ্ছে...", cur)
                    } else {
                        format!("Searching internet & mirrors for {}...", cur)
                    },
                    action: Some("hunt_stream".to_string()),
                    param: Some(cur.clone()),
                };
            }
        }

        // 5. Category Selection
        let cat_map = [
            ("news", "News", "সংবাদ"),
            ("sports", "Sports", "খেলা"),
            ("movie", "Movies", "মুভি"),
            ("cinema", "Movies", "সিনেমা"),
            ("kid", "Kids", "কার্টুন"),
            ("music", "Music", "গান"),
            ("india", "India", "ইন্ডিয়া"),
            ("favorite", "Favorites", "ফেভারিট"),
        ];
        for (k_en, cat, k_bn) in cat_map {
            if lower.contains(k_en) || lower.contains(k_bn) {
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("{} ক্যাটাগরির চ্যানেলগুলো ফিল্টার করা হলো।", cat)
                    } else {
                        format!("Filtering {} channels.", cat)
                    },
                    action: Some("set_category".to_string()),
                    param: Some(cat.to_string()),
                };
            }
        }

        // 6. Play Channel Match
        for ch in &context.channel_sample {
            let norm_ch = ch.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>();
            let norm_msg = lower.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>();
            if !norm_ch.is_empty() && (norm_msg.contains(&norm_ch) || norm_ch.contains(&norm_msg)) {
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("{} চালু করা হচ্ছে...", ch)
                    } else {
                        format!("Switching to {}...", ch)
                    },
                    action: Some("play_channel".to_string()),
                    param: Some(ch.clone()),
                };
            }
        }

        AiChatResponse {
            reply: if is_bengali {
                format!("আপনার অনুরোধটি গৃহীত হয়েছে: \"{}\"। Settings এ যেকোনো AI Provider API Key যুক্ত করলে আরও নিখুঁত উত্তর পাবেন।", msg)
            } else {
                format!("Received command: \"{}\". Add an AI Provider API Key in Settings for natural language intelligence.", msg)
            },
            action: None,
            param: None,
        }
    }

    /// Autonomously crawls upstream feeds and internet index to recover broken favorite streams
    pub async fn autonomous_stream_hunt(
        channel_name: &str,
        custom_sources: &[String],
    ) -> Option<String> {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(2500))
            .connect_timeout(Duration::from_millis(1500))
            .build()
        {
            Ok(c) => c,
            Err(_) => return None,
        };

        let target_norm: String = channel_name
            .to_lowercase()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();

        // 1. First probe known backup mirrors
        for &(key, mirrors) in sentinel::KNOWN_BACKUP_MIRRORS {
            if sentinel::matches_backup_mirror_key(channel_name, "", key) {
                for &m in mirrors {
                    let res = sentinel::probe_single_url(&client, m).await;
                    if res.ok {
                        return Some(res.active_url);
                    }
                }
            }
        }

        // 2. Scan User Custom Sources
        for src in custom_sources {
            if let Ok(resp) = client.get(src).timeout(Duration::from_secs(5)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, "Custom", "Custom Feed", false);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(res.active_url);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Scan Upstream Providers (India, Bengali, Regional)
        for provider in sentinel::UPSTREAM_PROVIDERS {
            let is_priority = provider.name.to_lowercase().contains("india")
                || provider.name.to_lowercase().contains("bengali")
                || provider.name.to_lowercase().contains("bangladesh")
                || provider.name.to_lowercase().contains("samsung");

            if !is_priority {
                continue;
            }

            if let Ok(resp) = client.get(provider.url).timeout(Duration::from_secs(6)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, provider.default_group, provider.provider, provider.is_vip);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(res.active_url);
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }
}
