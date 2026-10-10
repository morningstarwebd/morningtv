// src-tauri/src/network/ai_brain/fallback.rs
// Offline Intent Engine, Typo/Phonetic Resolution & Multilingual Tool Guidance

use super::{AiChatResponse, AiContext};

pub struct FallbackIntentEngine;

impl FallbackIntentEngine {
    /// Infers channel/volume actions if LLM answered in plain text
    pub fn infer_action_from_interaction(
        ai_text: &str,
        user_query: &str,
        context: &AiContext,
    ) -> (Option<String>, Option<String>) {
        let lower_user = user_query.to_lowercase();
        let lower_ai = ai_text.to_lowercase();

        // Check Hungama / phonetic
        if lower_user.contains("hugama") || lower_user.contains("hungama") || lower_ai.contains("hungama") {
            return (Some("play_channel".to_string()), Some("Hungama".to_string()));
        }

        // Check hunt intent
        if lower_user.contains("hunt")
            || lower_user.contains("heal")
            || lower_user.contains("recover")
            || lower_user.contains("হারিয়ে")
            || lower_user.contains("হারিয়ে")
            || lower_user.contains("not working")
        {
            if let Some(target) = super::crawler::StreamCrawler::extract_channel_target(user_query) {
                return (Some("hunt_stream".to_string()), Some(target));
            }
        }

        // Check play channel in sample
        for ch in &context.channel_sample {
            let ch_norm = ch.to_lowercase();
            if lower_user.contains(&ch_norm) || lower_ai.contains(&ch_norm) {
                return (Some("play_channel".to_string()), Some(ch.clone()));
            }
        }

        // Check volume
        if lower_user.contains("volume") || lower_user.contains("sound") {
            let digits: String = lower_user.chars().filter(|c| c.is_ascii_digit()).collect();
            if let Ok(num) = digits.parse::<i64>() {
                return (Some("set_volume".to_string()), Some(num.clamp(0, 100).to_string()));
            }
        }

        (None, None)
    }

    /// Smart local intent parser when offline or no API key configured (English default, bilingual Bengali)
    pub fn local_fallback_intent(msg: &str, context: &AiContext) -> AiChatResponse {
        let lower = msg.to_lowercase();
        let is_bengali = msg.chars().any(|c| ('\u{0980}'..='\u{09FF}').contains(&c));

        // 0. Capabilities & Available Tools Query
        if lower.contains("ক্ষমতা")
            || lower.contains("টুল")
            || lower.contains("tools")
            || lower.contains("capabilities")
            || lower.contains("what can you do")
            || lower.contains("what are you capable of")
            || lower.contains("কি করতে পার")
            || lower.contains("কী করতে পার")
            || lower.contains("কি কি করতে")
            || lower.contains("কী কী করতে")
            || lower.contains("সাহায্য")
            || lower.trim() == "help"
        {
            return AiChatResponse {
                reply: if is_bengali {
                    "আমি MorningTV AI কো-পাইলট। আমার কাছে নিচের সিস্টেম টুলগুলোর এক্সেস রয়েছে:\n\n\
                    1. 📺 'play_channel': ১০,০০০+ চ্যানেলের যেকোনো চ্যানেল চালানো (যেমন: 'Play Hungama', 'জি বাংলা চালাও')।\n\
                    2. ⚡ 'hunt_stream': লাইভ স্ট্রিম নষ্ট বা লিঙ্ক হারিয়ে গেলে ইন্টারনেট থেকে রিকভার করে ডাটাবেসে সেভ করা (যেমন: 'Hunt Zee Bangla HD')।\n\
                    3. 🔊 'set_volume': সাউন্ড বা ভলিউম নিয়ন্ত্রণ করা (যেমন: 'Volume 60%')।\n\
                    4. 🔇 'toggle_mute': সাউন্ড মিউট বা আনমিউট করা।\n\
                    5. 📑 'set_category': ক্যাটাগরি অনুসারে চ্যানেল ফিল্টার করা (Sports, News, Movies, Music, etc)।\n\
                    6. 🖥️ 'toggle_fullscreen': ফুলস্ক্রিন টগল করা।\n\n\
                    💡 আরও বুদ্ধিমান নিউরাল উত্তরের জন্য Settings-এ Groq বা Gemini API Key যুক্ত করুন!".to_string()
                } else {
                    "I am MorningTV AI Co-Pilot. Here are my available tools and application capabilities:\n\n\
                    1. 📺 'play_channel': Switch to any live channel in your 10,000+ library (e.g. 'Play Hungama', 'Switch to Star Jalsha').\n\
                    2. ⚡ 'hunt_stream': Autonomous internet stream healer. Recovers broken/missing streams directly into your database.\n\
                    3. 🔊 'set_volume': Set precise audio volume level (e.g. 'Set volume to 50%').\n\
                    4. 🔇 'toggle_mute': Toggle audio mute status.\n\
                    5. 📑 'set_category': Filter library by category (Sports, News, Movies, Kids, etc).\n\
                    6. 🖥️ 'toggle_fullscreen': Enter or exit fullscreen playback.\n\n\
                    💡 Connect your Groq or Gemini API Key in Settings for full neural conversation!".to_string()
                },
                action: None,
                param: None,
            };
        }

        // 0.1 Direct Hungama / phonetic playback match
        if lower.contains("hugama") || lower.contains("hungama") || lower.contains("হুগামা") || lower.contains("হাঙ্গামা") {
            return AiChatResponse {
                reply: if is_bengali {
                    "Hungama চ্যানেল চালু করা হচ্ছে...".to_string()
                } else {
                    "Switching to Hungama...".to_string()
                },
                action: Some("play_channel".to_string()),
                param: Some("Hungama".to_string()),
            };
        }

        // 0.2 Smart Reminders / Sleep Timers
        if let Some(timer_act) = super::scheduler::SchedulerAgent::parse_schedule_intent(msg) {
            return AiChatResponse {
                reply: timer_act.reply_text,
                action: Some(timer_act.action_type),
                param: timer_act.channel_target.or(Some(timer_act.delay_seconds.to_string())),
            };
        }

        // 0.3 Mood & Vibe Recommendation
        if let Some((vibe_ch, vibe_reply)) = super::vibe::VibeClassifier::recommend_by_vibe(msg, &context.channel_sample) {
            return AiChatResponse {
                reply: vibe_reply,
                action: Some("play_channel".to_string()),
                param: Some(vibe_ch),
            };
        }

        // 0.4 Live Program & EPG Intelligence
        if lower.contains("চলছে")
            || lower.contains("হচ্ছে")
            || lower.contains("what is on")
            || lower.contains("what's on")
            || lower.contains("showing")
            || lower.contains("schedule")
        {
            let (epg_ch, epg_reply) = super::epg::EpgIntelligence::query_schedule(
                msg,
                context.current_channel.as_deref(),
                &context.channel_sample,
            );
            return AiChatResponse {
                reply: epg_reply,
                action: epg_ch.as_ref().map(|_| "play_channel".to_string()),
                param: epg_ch,
            };
        }

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

        // 4. Broken Stream Hunt / Channel Recovery & Database Insertion
        let is_hunt = lower.contains("খুঁজে")
            || lower.contains("hunt")
            || lower.contains("heal")
            || lower.contains("fix")
            || lower.contains("not working")
            || lower.contains("কাজ করছে না")
            || lower.contains("চলছে না")
            || lower.contains("হারিয়ে")
            || lower.contains("হারিয়ে")
            || lower.contains("lost")
            || lower.contains("missing")
            || lower.contains("যোগ করো")
            || lower.contains("এড করো")
            || lower.contains("অ্যাড করো");

        if is_hunt {
            for ch in &context.channel_sample {
                let norm_ch = ch.to_lowercase();
                if lower.contains(&norm_ch) || (norm_ch.len() > 3 && lower.contains(&norm_ch[..norm_ch.len().min(6)])) {
                    return AiChatResponse {
                        reply: if is_bengali {
                            format!("ইন্টারনেট ও আপস্ট্রিম প্রোভাইডার থেকে {} সন্ধান করে ডাটাবেসে রিকভার করা হচ্ছে...", ch)
                        } else {
                            format!("Searching internet & upstream mirrors to recover {}...", ch)
                        },
                        action: Some("hunt_stream".to_string()),
                        param: Some(ch.clone()),
                    };
                }
            }

            if let Some(target) = super::crawler::StreamCrawler::extract_channel_target(msg) {
                return AiChatResponse {
                    reply: if is_bengali {
                        format!("ইন্টারনেট ও ব্যাকআপ প্রোভাইডার থেকে \"{}\" সন্ধান করে ডাটাবেসে রিকভার করা হচ্ছে...", target)
                    } else {
                        format!("Searching internet & upstream providers to recover \"{}\" and add to database...", target)
                    },
                    action: Some("hunt_stream".to_string()),
                    param: Some(target),
                };
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
}
