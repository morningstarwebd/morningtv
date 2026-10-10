// src-tauri/src/network/ai_brain/scheduler.rs
// Smart Reminders, Sleep Timers & Auto-Tune Scheduling Agent

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleTimerAction {
    pub action_type: String, // "sleep_timer" | "schedule_channel"
    pub delay_seconds: u64,
    pub channel_target: Option<String>,
    pub reply_text: String,
}

pub struct SchedulerAgent;

impl SchedulerAgent {
    /// Parses natural language sleep timer or channel reminder commands
    pub fn parse_schedule_intent(msg: &str) -> Option<ScheduleTimerAction> {
        let lower = msg.to_lowercase();
        let is_bengali = msg.chars().any(|c| ('\u{0980}'..='\u{09FF}').contains(&c));

        // 1. Sleep Timer detection
        let is_sleep_timer = lower.contains("sleep")
            || lower.contains("বন্ধ করে দিও")
            || lower.contains("বন্ধ করবে")
            || lower.contains("বন্ধ করো")
            || lower.contains("turn off");

        if is_sleep_timer {
            // Extract minutes
            let digits: String = lower.chars().filter(|c| c.is_ascii_digit()).collect();
            let minutes: u64 = digits.parse().unwrap_or(30).clamp(1, 480);
            let delay_seconds = minutes * 60;

            let reply = if is_bengali {
                format!("⏰ স্লিপ টাইমার সেট করা হলো: {} মিনিট পর প্লেব্যাক স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।", minutes)
            } else {
                format!("⏰ Sleep timer activated: Playback will automatically turn off in {} minutes.", minutes)
            };

            return Some(ScheduleTimerAction {
                action_type: "sleep_timer".to_string(),
                delay_seconds,
                channel_target: None,
                reply_text: reply,
            });
        }

        // 2. Channel Reminder / Auto-Tune detection
        let is_schedule_channel = lower.contains("মনে করিয়ে দিও")
            || lower.contains("চালিয়ে দিও")
            || lower.contains("switch at")
            || lower.contains("tune at")
            || lower.contains("remind me");

        if is_schedule_channel {
            // Extract channel target
            let target = super::crawler::StreamCrawler::extract_channel_target(msg)
                .unwrap_or_else(|| "Zee Bangla HD".to_string());

            let reply = if is_bengali {
                format!("⏰ শিডিউল অ্যালার্ট সেট করা হলো: নির্ধারিত সময়ে স্বয়ংক্রিয়ভাবে '{}' চ্যানেলে সুইচ করা হবে।", target)
            } else {
                format!("⏰ Scheduled auto-tune set: Will automatically switch to '{}' at scheduled time.", target)
            };

            return Some(ScheduleTimerAction {
                action_type: "schedule_channel".to_string(),
                delay_seconds: 1800, // default 30 mins demo buffer
                channel_target: Some(target),
                reply_text: reply,
            });
        }

        None
    }
}
