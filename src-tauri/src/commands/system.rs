// src-tauri/src/commands/system.rs
// System-level commands for autostart management, tray, and browser interactions

use crate::tray::{is_autostart_enabled, open_github_repo, set_autostart_enabled};

#[tauri::command]
pub fn get_startup_status() -> Result<bool, String> {
    Ok(is_autostart_enabled())
}

#[tauri::command]
pub fn set_startup_status(enabled: bool) -> Result<bool, String> {
    set_autostart_enabled(enabled)
}

#[tauri::command]
pub fn open_github_url() -> Result<(), String> {
    open_github_repo();
    Ok(())
}
