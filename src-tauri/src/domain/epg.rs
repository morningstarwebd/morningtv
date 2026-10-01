// src-tauri/src/domain/epg.rs
// Electronic Program Guide (EPG) domain entities & broadcast timeline synthesizer

use chrono::{Local, Timelike};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EpgProgram {
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub progress: u8, // 0 - 100%
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChannelEpg {
    pub current: Option<EpgProgram>,
    pub next: Option<EpgProgram>,
}

impl ChannelEpg {
    /// Generates an authentic, synchronized broadcast schedule for any channel based on the current clock
    pub fn synthesize(channel_name: &str, group_title: Option<&str>) -> Self {
        let now = Local::now();
        let hour = now.hour();
        let minute = now.minute();
        let name_lower = channel_name.to_lowercase();
        let group_lower = group_title.unwrap_or("").to_lowercase();

        let is_news = group_lower.contains("news") || name_lower.contains("news") || name_lower.contains("24") || name_lower.contains("aaj");
        let is_sports = group_lower.contains("sport") || name_lower.contains("sport") || name_lower.contains("cricket") || name_lower.contains("football");
        let is_movies = group_lower.contains("movie") || group_lower.contains("cinema") || name_lower.contains("cinema") || name_lower.contains("movie") || name_lower.contains("film");
        let is_kids = group_lower.contains("kid") || group_lower.contains("animation") || name_lower.contains("cartoon") || name_lower.contains("pogo") || name_lower.contains("nick");
        let is_music = group_lower.contains("music") || name_lower.contains("music") || name_lower.contains("vh1") || name_lower.contains("mtv");

        if is_news {
            // 30-minute news bulletin cycles
            let slot_start_min = if minute < 30 { 0 } else { 30 };
            let slot_end_min = if minute < 30 { 30 } else { 0 };
            let next_hour = if minute >= 30 { (hour + 1) % 24 } else { hour };
            let elapsed_mins = minute - slot_start_min;
            let progress = ((elapsed_mins as f32 / 30.0) * 100.0).clamp(0.0, 100.0) as u8;

            let titles = [
                "Prime Live News Bulletin & Top Stories",
                "World Focus: Ground Reports & Headlines",
                "Special Investigative Report & Debate",
                "Speed 50: Continuous Breaking News",
            ];
            let title_idx = ((hour * 2 + (if minute >= 30 { 1 } else { 0 })) as usize) % titles.len();
            let next_title_idx = (title_idx + 1) % titles.len();

            let current = EpgProgram {
                title: titles[title_idx].to_string(),
                description: Some(format!("Live 24/7 coverage and investigative reporting on {}", channel_name)),
                start_time: format!("{:02}:{:02} {}", if hour % 12 == 0 { 12 } else { hour % 12 }, slot_start_min, if hour < 12 { "AM" } else { "PM" }),
                end_time: format!("{:02}:{:02} {}", if next_hour % 12 == 0 { 12 } else { next_hour % 12 }, slot_end_min, if next_hour < 12 { "AM" } else { "PM" }),
                progress,
            };

            let after_next_hour = if slot_end_min == 30 { next_hour } else { (next_hour + 1) % 24 };
            let after_next_min = if slot_end_min == 30 { 0 } else { 30 };
            let next = EpgProgram {
                title: titles[next_title_idx].to_string(),
                description: Some(format!("Coming up next on {}", channel_name)),
                start_time: current.end_time.clone(),
                end_time: format!("{:02}:{:02} {}", if after_next_hour % 12 == 0 { 12 } else { after_next_hour % 12 }, after_next_min, if after_next_hour < 12 { "AM" } else { "PM" }),
                progress: 0,
            };

            Self {
                current: Some(current),
                next: Some(next),
            }
        } else if is_sports {
            // 2-hour sports broadcast blocks
            let block = hour / 2;
            let start_h = block * 2;
            let end_h = (start_h + 2) % 24;
            let elapsed_mins = (hour - start_h) * 60 + minute;
            let progress = ((elapsed_mins as f32 / 120.0) * 100.0).clamp(0.0, 100.0) as u8;

            let titles = [
                "World Championship Tour: Live Match",
                "Live Arena Show & Pre-Game Analysis",
                "Championship Action: Extended Highlights",
                "Classic Tournament Final: Epic Encounters",
            ];
            let idx = (block as usize) % titles.len();
            let next_idx = (idx + 1) % titles.len();

            let current = EpgProgram {
                title: titles[idx].to_string(),
                description: Some(format!("High-stakes tournament coverage and commentary on {}", channel_name)),
                start_time: format!("{:02}:00 {}", if start_h % 12 == 0 { 12 } else { start_h % 12 }, if start_h < 12 { "AM" } else { "PM" }),
                end_time: format!("{:02}:00 {}", if end_h % 12 == 0 { 12 } else { end_h % 12 }, if end_h < 12 { "AM" } else { "PM" }),
                progress,
            };

            let next_end_h = (end_h + 2) % 24;
            let next = EpgProgram {
                title: titles[next_idx].to_string(),
                description: Some(format!("Upcoming match broadcast on {}", channel_name)),
                start_time: current.end_time.clone(),
                end_time: format!("{:02}:00 {}", if next_end_h % 12 == 0 { 12 } else { next_end_h % 12 }, if next_end_h < 12 { "AM" } else { "PM" }),
                progress: 0,
            };

            Self {
                current: Some(current),
                next: Some(next),
            }
        } else if is_movies {
            // 2-hour cinema slots
            let block = hour / 2;
            let start_h = block * 2;
            let end_h = (start_h + 2) % 24;
            let elapsed_mins = (hour - start_h) * 60 + minute;
            let progress = ((elapsed_mins as f32 / 120.0) * 100.0).clamp(0.0, 100.0) as u8;

            let titles = [
                "Blockbuster Cinema: Prime Feature Film",
                "Mega Movie Matinee: Action & Thriller",
                "Gold Cinema Special: Romantic Drama",
                "Late Night Hollywood Premiere",
            ];
            let idx = (block as usize) % titles.len();
            let next_idx = (idx + 1) % titles.len();

            let current = EpgProgram {
                title: titles[idx].to_string(),
                description: Some(format!("Full-length feature film presentation on {}", channel_name)),
                start_time: format!("{:02}:00 {}", if start_h % 12 == 0 { 12 } else { start_h % 12 }, if start_h < 12 { "AM" } else { "PM" }),
                end_time: format!("{:02}:00 {}", if end_h % 12 == 0 { 12 } else { end_h % 12 }, if end_h < 12 { "AM" } else { "PM" }),
                progress,
            };

            let next_end_h = (end_h + 2) % 24;
            let next = EpgProgram {
                title: titles[next_idx].to_string(),
                description: Some(format!("Upcoming feature presentation on {}", channel_name)),
                start_time: current.end_time.clone(),
                end_time: format!("{:02}:00 {}", if next_end_h % 12 == 0 { 12 } else { next_end_h % 12 }, if next_end_h < 12 { "AM" } else { "PM" }),
                progress: 0,
            };

            Self {
                current: Some(current),
                next: Some(next),
            }
        } else if is_kids {
            // 30-min cartoon blocks
            let slot_start_min = if minute < 30 { 0 } else { 30 };
            let slot_end_min = if minute < 30 { 30 } else { 0 };
            let next_hour = if minute >= 30 { (hour + 1) % 24 } else { hour };
            let elapsed_mins = minute - slot_start_min;
            let progress = ((elapsed_mins as f32 / 30.0) * 100.0).clamp(0.0, 100.0) as u8;

            let titles = [
                "Animated Adventures & Fun Toons",
                "Cartoons Playhouse: Mystery Squad",
                "Super Kids World & Fun Quests",
                "Magical Toon Express Show",
            ];
            let idx = ((hour * 2 + (if minute >= 30 { 1 } else { 0 })) as usize) % titles.len();
            let next_idx = (idx + 1) % titles.len();

            let current = EpgProgram {
                title: titles[idx].to_string(),
                description: Some(format!("Family & kids animation on {}", channel_name)),
                start_time: format!("{:02}:{:02} {}", if hour % 12 == 0 { 12 } else { hour % 12 }, slot_start_min, if hour < 12 { "AM" } else { "PM" }),
                end_time: format!("{:02}:{:02} {}", if next_hour % 12 == 0 { 12 } else { next_hour % 12 }, slot_end_min, if next_hour < 12 { "AM" } else { "PM" }),
                progress,
            };

            let after_next_hour = if slot_end_min == 30 { next_hour } else { (next_hour + 1) % 24 };
            let after_next_min = if slot_end_min == 30 { 0 } else { 30 };
            let next = EpgProgram {
                title: titles[next_idx].to_string(),
                description: Some(format!("Upcoming animated episode on {}", channel_name)),
                start_time: current.end_time.clone(),
                end_time: format!("{:02}:{:02} {}", if after_next_hour % 12 == 0 { 12 } else { after_next_hour % 12 }, after_next_min, if after_next_hour < 12 { "AM" } else { "PM" }),
                progress: 0,
            };

            Self {
                current: Some(current),
                next: Some(next),
            }
        } else if is_music {
            // Music 1-hour broadcast blocks
            let start_h = hour;
            let end_h = (hour + 1) % 24;
            let progress = ((minute as f32 / 60.0) * 100.0).clamp(0.0, 100.0) as u8;

            let titles = [
                "Top 40 Chartbusters & Non-Stop Beats",
                "Retro Golden Era: Timeless Classics",
                "Acoustic Sessions & Unplugged Live",
                "Global Dance Anthems & Club Hits",
            ];
            let idx = (hour as usize) % titles.len();
            let next_idx = (idx + 1) % titles.len();

            let current = EpgProgram {
                title: titles[idx].to_string(),
                description: Some(format!("Continuous music and visualization on {}", channel_name)),
                start_time: format!("{:02}:00 {}", if start_h % 12 == 0 { 12 } else { start_h % 12 }, if start_h < 12 { "AM" } else { "PM" }),
                end_time: format!("{:02}:00 {}", if end_h % 12 == 0 { 12 } else { end_h % 12 }, if end_h < 12 { "AM" } else { "PM" }),
                progress,
            };

            let next_end_h = (end_h + 1) % 24;
            let next = EpgProgram {
                title: titles[next_idx].to_string(),
                description: Some(format!("Coming up next on {}", channel_name)),
                start_time: current.end_time.clone(),
                end_time: format!("{:02}:00 {}", if next_end_h % 12 == 0 { 12 } else { next_end_h % 12 }, if next_end_h < 12 { "AM" } else { "PM" }),
                progress: 0,
            };

            Self {
                current: Some(current),
                next: Some(next),
            }
        } else {
            // General / Entertainment 1-hour slots
            let start_h = hour;
            let end_h = (hour + 1) % 24;
            let progress = ((minute as f32 / 60.0) * 100.0).clamp(0.0, 100.0) as u8;

            let titles = [
                "Prime Drama Series: Season Premiere",
                "Daily Reality Show & Studio Highlights",
                "Celebrity Showcase & Lifestyle Special",
                "Late Night Variety & Comedy Hour",
            ];
            let idx = (hour as usize) % titles.len();
            let next_idx = (idx + 1) % titles.len();

            let current = EpgProgram {
                title: titles[idx].to_string(),
                description: Some(format!("Popular broadcast programming on {}", channel_name)),
                start_time: format!("{:02}:00 {}", if start_h % 12 == 0 { 12 } else { start_h % 12 }, if start_h < 12 { "AM" } else { "PM" }),
                end_time: format!("{:02}:00 {}", if end_h % 12 == 0 { 12 } else { end_h % 12 }, if end_h < 12 { "AM" } else { "PM" }),
                progress,
            };

            let next_end_h = (end_h + 1) % 24;
            let next = EpgProgram {
                title: titles[next_idx].to_string(),
                description: Some(format!("Coming up next on {}", channel_name)),
                start_time: current.end_time.clone(),
                end_time: format!("{:02}:00 {}", if next_end_h % 12 == 0 { 12 } else { next_end_h % 12 }, if next_end_h < 12 { "AM" } else { "PM" }),
                progress: 0,
            };

            Self {
                current: Some(current),
                next: Some(next),
            }
        }
    }
}
