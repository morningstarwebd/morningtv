// src-tauri/src/network/ai_brain/providers.rs
// Multi-Provider Detection, Model Enumeration & API Connectivity Verification

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
pub struct AiModelItem {
    pub id: String,
    pub is_free: bool,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDetectionResult {
    pub success: bool,
    pub provider_name: String,
    pub active_model: String,
    pub available_models: Vec<String>,
    #[serde(default)]
    pub models: Vec<AiModelItem>,
    pub latency_ms: u128,
    pub endpoint: String,
    pub message: String,
}

pub struct ProviderManager;

impl ProviderManager {
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
                "Groq LPU (Meta Llama)".to_string(),
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
        } else if clean.starts_with("xai-") {
            (
                "xAI Grok".to_string(),
                "https://api.x.ai/v1/chat/completions".to_string(),
                "grok-4.7".to_string(),
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
            (
                "Universal AI Provider".to_string(),
                "https://api.groq.com/openai/v1/chat/completions".to_string(),
                "llama-3.3-70b-versatile".to_string(),
            )
        }
    }

    /// Resolves provider endpoint and default model based on explicit selection or key inspection
    pub fn get_provider_config(
        preferred_provider: Option<&str>,
        key: &str,
        custom_endpoint: Option<&str>,
    ) -> (String, String, String) {
        if let Some(prov) = preferred_provider {
            let p_lower = prov.to_lowercase();
            if p_lower.contains("groq") {
                return (
                    "Groq LPU (Meta Llama)".to_string(),
                    "https://api.groq.com/openai/v1/chat/completions".to_string(),
                    "llama-3.3-70b-versatile".to_string(),
                );
            } else if p_lower.contains("xai") || p_lower.contains("grok") {
                return (
                    "xAI Grok".to_string(),
                    "https://api.x.ai/v1/chat/completions".to_string(),
                    "grok-4.7".to_string(),
                );
            } else if p_lower.contains("gemini") || p_lower.contains("google") {
                return (
                    "Google Gemini".to_string(),
                    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions".to_string(),
                    "gemini-1.5-flash".to_string(),
                );
            } else if p_lower.contains("openrouter") {
                return (
                    "OpenRouter".to_string(),
                    "https://openrouter.ai/api/v1/chat/completions".to_string(),
                    "meta-llama/llama-3.3-70b-instruct:free".to_string(),
                );
            } else if p_lower.contains("deepseek") {
                return (
                    "DeepSeek".to_string(),
                    "https://api.deepseek.com/chat/completions".to_string(),
                    "deepseek-chat".to_string(),
                );
            } else if p_lower.contains("openai") {
                return (
                    "OpenAI".to_string(),
                    "https://api.openai.com/v1/chat/completions".to_string(),
                    "gpt-4o-mini".to_string(),
                );
            } else if p_lower.contains("ollama") || p_lower.contains("local") {
                let ep = custom_endpoint
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or("http://localhost:11434/v1");
                let base = ep.trim_end_matches('/');
                let chat_url = if base.ends_with("/chat/completions") {
                    base.to_string()
                } else {
                    format!("{}/chat/completions", base)
                };
                return (
                    "Ollama / Local Provider".to_string(),
                    chat_url,
                    "llama3.2".to_string(),
                );
            }
        }
        Self::infer_provider_config(key, custom_endpoint)
    }

    /// Fetches available models live from provider servers, tagging free tier models
    pub async fn fetch_provider_models(
        provider_name: &str,
        api_key: Option<&str>,
        custom_endpoint: Option<&str>,
    ) -> Vec<AiModelItem> {
        let p = provider_name.to_lowercase();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(6))
            .build()
            .unwrap_or_default();

        let mut models = Vec::new();

        if p.contains("groq") {
            if let Some(key) = api_key {
                if !key.trim().is_empty() {
                    if let Ok(resp) = client
                        .get("https://api.groq.com/openai/v1/models")
                        .header("Authorization", format!("Bearer {}", key.trim()))
                        .send()
                        .await
                    {
                        if resp.status().is_success() {
                            if let Ok(list) = resp.json::<ModelsListResponse>().await {
                                for m in list.data {
                                    if !m.id.contains("whisper") {
                                        models.push(AiModelItem {
                                            id: m.id.clone(),
                                            is_free: true,
                                            label: format!("{} [FREE TIER]", m.id),
                                        });
                                    }
                                }
                                models.sort_by(|a, b| {
                                    let a_is_llama = a.id.contains("llama-3.3") || a.id.contains("llama-3.1");
                                    let b_is_llama = b.id.contains("llama-3.3") || b.id.contains("llama-3.1");
                                    b_is_llama.cmp(&a_is_llama)
                                });
                            }
                        }
                    }
                }
            }
            if models.is_empty() {
                models = vec![
                    AiModelItem { id: "llama-3.3-70b-versatile".to_string(), is_free: true, label: "llama-3.3-70b-versatile [FREE TIER]".to_string() },
                    AiModelItem { id: "llama-3.1-8b-instant".to_string(), is_free: true, label: "llama-3.1-8b-instant [FREE TIER]".to_string() },
                    AiModelItem { id: "openai/gpt-oss-120b".to_string(), is_free: true, label: "openai/gpt-oss-120b [FREE TIER]".to_string() },
                    AiModelItem { id: "openai/gpt-oss-20b".to_string(), is_free: true, label: "openai/gpt-oss-20b [FREE TIER]".to_string() },
                    AiModelItem { id: "qwen/qwen3.8-27b".to_string(), is_free: true, label: "qwen/qwen3.8-27b [FREE TIER]".to_string() },
                ];
            }
        } else if p.contains("gemini") || p.contains("google") {
            if let Some(key) = api_key {
                if !key.trim().is_empty() {
                    if let Ok(resp) = client
                        .get("https://generativelanguage.googleapis.com/v1beta/openai/models")
                        .header("Authorization", format!("Bearer {}", key.trim()))
                        .send()
                        .await
                    {
                        if resp.status().is_success() {
                            if let Ok(list) = resp.json::<ModelsListResponse>().await {
                                for m in list.data {
                                    let id = m.id.trim_start_matches("models/").to_string();
                                    let is_free = id.contains("flash") || id.contains("1.5") || id.contains("2.0");
                                    models.push(AiModelItem {
                                        id: id.clone(),
                                        is_free,
                                        label: if is_free { format!("{} [FREE TIER]", id) } else { id },
                                    });
                                }
                            }
                        }
                    }
                }
            }
            if models.is_empty() {
                models = vec![
                    AiModelItem { id: "gemini-1.5-flash".to_string(), is_free: true, label: "gemini-1.5-flash [FREE TIER]".to_string() },
                    AiModelItem { id: "gemini-2.0-flash".to_string(), is_free: true, label: "gemini-2.0-flash [FREE TIER]".to_string() },
                    AiModelItem { id: "gemini-1.5-pro".to_string(), is_free: true, label: "gemini-1.5-pro [FREE TIER]".to_string() },
                ];
            }
        } else if p.contains("openrouter") {
            if let Ok(resp) = client.get("https://openrouter.ai/api/v1/models").send().await {
                if resp.status().is_success() {
                    if let Ok(list) = resp.json::<ModelsListResponse>().await {
                        let mut free_models = Vec::new();
                        let mut paid_models = Vec::new();
                        for m in list.data {
                            if m.id.contains(":free") {
                                free_models.push(AiModelItem {
                                    id: m.id.clone(),
                                    is_free: true,
                                    label: format!("{} [FREE TIER]", m.id),
                                });
                            } else if paid_models.len() < 20 {
                                paid_models.push(AiModelItem {
                                    id: m.id.clone(),
                                    is_free: false,
                                    label: m.id.clone(),
                                });
                            }
                        }
                        models.extend(free_models);
                        models.extend(paid_models);
                    }
                }
            }
        } else if p.contains("ollama") || p.contains("local") {
            let ep = custom_endpoint
                .filter(|s| !s.trim().is_empty())
                .unwrap_or("http://localhost:11434");
            let base = ep.trim_end_matches('/');
            let tags_url = format!("{}/api/tags", base);
            if let Ok(resp) = client.get(&tags_url).send().await {
                if resp.status().is_success() {
                    #[derive(Deserialize)]
                    struct OllamaTagItem { name: String }
                    #[derive(Deserialize)]
                    struct OllamaTagsResp { models: Vec<OllamaTagItem> }
                    if let Ok(parsed) = resp.json::<OllamaTagsResp>().await {
                        for m in parsed.models {
                            models.push(AiModelItem {
                                id: m.name.clone(),
                                is_free: true,
                                label: format!("{} [LOCAL FREE]", m.name),
                            });
                        }
                    }
                }
            }
            if models.is_empty() {
                models = vec![
                    AiModelItem { id: "llama3.2".to_string(), is_free: true, label: "llama3.2 [LOCAL]".to_string() },
                    AiModelItem { id: "mistral".to_string(), is_free: true, label: "mistral [LOCAL]".to_string() },
                ];
            }
        }

        models
    }

    /// Verifies provider connectivity and returns latency and available models
    pub async fn detect_and_verify(
        api_key: &str,
        custom_endpoint: Option<&str>,
        preferred_provider: Option<&str>,
        preferred_model: Option<&str>,
    ) -> Result<ProviderDetectionResult, String> {
        let key = api_key.trim();
        let is_local = preferred_provider
            .map(|p| p.to_lowercase().contains("ollama") || p.to_lowercase().contains("local"))
            .unwrap_or(false)
            || custom_endpoint.map(|e| e.contains("localhost") || e.contains("127.0.0.1")).unwrap_or(false);

        if key.is_empty() && !is_local {
            return Err("API key is empty".to_string());
        }

        let (provider_name, endpoint, default_model) =
            Self::get_provider_config(preferred_provider, key, custom_endpoint);
        let active_model = preferred_model
            .filter(|m| !m.trim().is_empty())
            .unwrap_or(&default_model)
            .to_string();

        let start = std::time::Instant::now();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .map_err(|e| e.to_string())?;

        let models = Self::fetch_provider_models(&provider_name, Some(key), custom_endpoint).await;
        let available_models: Vec<String> = models.iter().map(|m| m.id.clone()).collect();

        let request = ChatCompletionRequest {
            model: &active_model,
            messages: vec![ChatMessage {
                role: "user",
                content: "ping",
            }],
            max_tokens: 5,
            temperature: 0.1,
            response_format: None,
        };

        let mut req_builder = client.post(&endpoint).header("Content-Type", "application/json");
        if !key.is_empty() {
            req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
        }

        let response = req_builder
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
            provider_name, latency_ms, active_model
        );

        Ok(ProviderDetectionResult {
            success: true,
            provider_name,
            active_model,
            available_models,
            models,
            latency_ms,
            endpoint,
            message,
        })
    }

    /// Legacy compatibility test connection wrapper
    pub async fn test_connection(api_key: &str) -> Result<String, String> {
        let res = Self::detect_and_verify(api_key, None, None, None).await?;
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
}
