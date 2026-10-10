// src-tauri/src/network/ai_brain/vibe.rs
// Mood & Vibe-based Channel Recommendation Engine

pub struct VibeClassifier;

impl VibeClassifier {
    /// Recommends channel based on emotional vibe, mood, or context
    pub fn recommend_by_vibe(
        user_query: &str,
        sample_channels: &[String],
    ) -> Option<(String, String)> {
        let lower = user_query.to_lowercase();
        let is_bengali = user_query.chars().any(|c| ('\u{0980}'..='\u{09FF}').contains(&c));

        // 1. Sad / Stressed / Need Laughs / Comedy
        if lower.contains("মন খারাপ")
            || lower.contains("ক্লান্ত")
            || lower.contains("হাসি")
            || lower.contains("sad")
            || lower.contains("stressed")
            || lower.contains("tired")
            || lower.contains("laugh")
            || lower.contains("comedy")
        {
            let comedy_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("sab") || lc.contains("comedy") || lc.contains("hungama")
                })
                .cloned()
                .unwrap_or_else(|| "Sony SAB".to_string());

            let reply = if is_bengali {
                format!(
                    "🎭 মন ভালো করার জন্য হালকা হাসির কমেডি শো দেখতে '{}' চালু করা হচ্ছে। একটু রিল্যাক্স করুন!",
                    comedy_channel
                )
            } else {
                format!(
                    "🎭 To cheer you up with lighthearted comedy, switching to '{}'. Enjoy and relax!",
                    comedy_channel
                )
            };
            return Some((comedy_channel, reply));
        }

        // 2. Relaxing / Sleep / Calm / Ambient Music
        if lower.contains("ঘুম")
            || lower.contains("রিলাক্স")
            || lower.contains("শান্ত")
            || lower.contains("sleep")
            || lower.contains("relax")
            || lower.contains("calm")
            || lower.contains("chill")
            || lower.contains("lofi")
        {
            let music_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("beats") || lc.contains("9xm") || lc.contains("music") || lc.contains("peace")
                })
                .cloned()
                .unwrap_or_else(|| "MTV Beats".to_string());

            let reply = if is_bengali {
                format!(
                    "🎵 রিলাক্সিং ও স্নিগ্ধ পরিবেশের জন্য '{}' প্লে করা হচ্ছে। শুভ বিশ্রাম!",
                    music_channel
                )
            } else {
                format!(
                    "🎵 Tuning into mellow music on '{}' to help you unwind and relax.",
                    music_channel
                )
            };
            return Some((music_channel, reply));
        }

        // 3. Energetic / Party / Dance
        if lower.contains("party")
            || lower.contains("dance")
            || lower.contains("শক্তি")
            || lower.contains("energetic")
            || lower.contains("গান")
        {
            let party_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("9xm") || lc.contains("zoom") || lc.contains("music")
                })
                .cloned()
                .unwrap_or_else(|| "9XM".to_string());

            let reply = if is_bengali {
                format!(
                    "🔥 ফুল এনার্জি ও পার্টি ভাইবের জন্য '{}' চালু করা হলো!",
                    party_channel
                )
            } else {
                format!(
                    "🔥 Setting up energetic party vibes with '{}'!",
                    party_channel
                )
            };
            return Some((party_channel, reply));
        }

        None
    }
}
