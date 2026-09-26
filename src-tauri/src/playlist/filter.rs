// src/playlist/filter.rs
// Channel search, category grouping, and filtering logic

use crate::domain::Channel;
use std::collections::HashMap;

pub struct ChannelFilter;

impl ChannelFilter {
    pub fn extract_categories(channels: &[Channel]) -> Vec<String> {
        let mut categories = Vec::new();

        // Always put "All" and "Favorites" first
        categories.push("All".to_string());
        categories.push("Favorites".to_string());

        let mut counts: HashMap<String, usize> = HashMap::new();
        for channel in channels {
            for part in channel.group.split(&[';', ','][..]) {
                let cat = part.trim();
                if !cat.is_empty() && !cat.eq_ignore_ascii_case("All") && !cat.eq_ignore_ascii_case("Favorites") {
                    *counts.entry(cat.to_string()).or_insert(0) += 1;
                }
            }
        }

        let mut sorted_cats: Vec<(String, usize)> = counts.into_iter().collect();
        // Sort descending by channel count, then alphabetically
        sorted_cats.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

        for (cat, _) in sorted_cats {
            categories.push(cat);
        }

        categories
    }

    pub fn filter_channels(
        channels: &[Channel],
        active_category: &str,
        search_query: &str,
    ) -> Vec<Channel> {
        channels
            .iter()
            .filter(|ch| {
                // Category match
                let cat_matches = match active_category {
                    "All" => true,
                    "Favorites" => ch.is_favorite,
                    custom => {
                        ch.group
                            .split(&[';', ','][..])
                            .any(|part| part.trim().eq_ignore_ascii_case(custom))
                    }
                };

                if !cat_matches {
                    return false;
                }

                // Search query match
                ch.matches_query(search_query)
            })
            .cloned()
            .collect()
    }
}
