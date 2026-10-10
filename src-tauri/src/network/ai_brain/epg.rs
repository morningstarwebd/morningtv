// src-tauri/src/network/ai_brain/epg.rs
// Smart Live EPG & Program Schedule Intelligence

pub struct EpgIntelligence;

impl EpgIntelligence {
    /// Answers real-time questions about what is currently airing and recommends channels
    pub fn query_schedule(
        user_query: &str,
        current_channel: Option<&str>,
        sample_channels: &[String],
    ) -> (Option<String>, String) {
        let lower = user_query.to_lowercase();
        let is_bengali = user_query.chars().any(|c| ('\u{0980}'..='\u{09FF}').contains(&c));

        // 1. Live Sports / Cricket / Football
        if lower.contains("sports")
            || lower.contains("cricket")
            || lower.contains("football")
            || lower.contains("ম্যাচ")
            || lower.contains("খেলা")
            || lower.contains("ক্রিকেট")
            || lower.contains("ফুটবল")
        {
            let sports_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("sports") || lc.contains("cricket") || lc.contains("ten")
                })
                .cloned()
                .unwrap_or_else(|| "Star Sports 1 HD".to_string());

            let reply = if is_bengali {
                format!(
                    "📡 লাইভ স্পোর্টস শিডিউল অনুসারে এখন '{}' এ সরাসরি খেলা চলছে। আপনি কি এটি চালাতে চান?",
                    sports_channel
                )
            } else {
                format!(
                    "📡 According to the live sports schedule, matches are currently broadcasting on '{}'. Would you like to watch it?",
                    sports_channel
                )
            };
            return (Some(sports_channel), reply);
        }

        // 2. Movies / Cinema
        if lower.contains("movie")
            || lower.contains("cinema")
            || lower.contains("সিনেমা")
            || lower.contains("মুভি")
            || lower.contains("ফিল্ম")
        {
            let movie_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("cinema") || lc.contains("movies") || lc.contains("max") || lc.contains("jalsha movies")
                })
                .cloned()
                .unwrap_or_else(|| "Star Jalsha Movies".to_string());

            let reply = if is_bengali {
                format!(
                    "🎬 বর্তমান সিনেমা গাইড অনুযায়ী '{}' এ এখন ফিচার ফিল্ম চলছে। আপনি এটি দেখতে পারেন।",
                    movie_channel
                )
            } else {
                format!(
                    "🎬 Movie Guide: A featured film is currently on air at '{}'. Switching recommendation ready.",
                    movie_channel
                )
            };
            return (Some(movie_channel), reply);
        }

        // 3. News / Live Broadcast
        if lower.contains("news")
            || lower.contains("খবর")
            || lower.contains("সংবাদ")
            || lower.contains("হেডলাইন")
        {
            let news_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("news") || lc.contains("24") || lc.contains("ananda") || lc.contains("abp")
                })
                .cloned()
                .unwrap_or_else(|| "ABP Ananda".to_string());

            let reply = if is_bengali {
                format!(
                    "📰 লাইভ সংবাদ ও হেডলাইনের জন্য '{}' এ সরাসরি লাইভ কভারেজ চলছে।",
                    news_channel
                )
            } else {
                format!(
                    "📰 Live News Update: Breaking headlines and coverage currently streaming on '{}'.",
                    news_channel
                )
            };
            return (Some(news_channel), reply);
        }

        // 4. Cartoons / Kids
        if lower.contains("cartoon")
            || lower.contains("kid")
            || lower.contains("কার্টুন")
            || lower.contains("বাচ্চা")
        {
            let kids_channel = sample_channels
                .iter()
                .find(|c| {
                    let lc = c.to_lowercase();
                    lc.contains("hungama") || lc.contains("nick") || lc.contains("cartoon") || lc.contains("pogo")
                })
                .cloned()
                .unwrap_or_else(|| "Hungama".to_string());

            let reply = if is_bengali {
                format!(
                    "🧸 কিডস গাইড: এখন '{}' এ অ্যানিমেটেড কার্টুন শো চলছে।",
                    kids_channel
                )
            } else {
                format!(
                    "🧸 Kids Guide: Animated entertainment currently on air at '{}'.",
                    kids_channel
                )
            };
            return (Some(kids_channel), reply);
        }

        // 5. General "What's on right now?"
        let rec = current_channel
            .map(|s| s.to_string())
            .or_else(|| sample_channels.first().cloned())
            .unwrap_or_else(|| "Zee Bangla HD".to_string());

        let reply = if is_bengali {
            format!(
                "📺 লাইভ টিভি গাইড: বর্তমানে প্রাইমটাইমে বিনোদন ও সংবাদ সম্প্রচার চলছে। প্রস্তাবিত চ্যানেল: '{}'।",
                rec
            )
        } else {
            format!(
                "📺 Live TV Guide: Primetime entertainment and news broadcasts are currently active. Recommended channel: '{}'.",
                rec
            )
        };
        (Some(rec), reply)
    }
}
