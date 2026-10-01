// src-tauri/src/commands/epg.rs
// Tauri IPC command handlers for Electronic Program Guide (EPG)

use crate::domain::epg::ChannelEpg;

#[tauri::command]
pub async fn get_channel_epg(
    channel_name: String,
    group_title: Option<String>,
) -> Result<ChannelEpg, String> {
    Ok(ChannelEpg::synthesize(&channel_name, group_title.as_deref()))
}
