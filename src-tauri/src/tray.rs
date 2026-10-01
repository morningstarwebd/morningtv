// src-tauri/src/tray.rs
// Windows System Tray integration with Quick Controls & Autostart Management

use std::sync::Arc;
use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

#[cfg(windows)]
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
#[cfg(windows)]
use winreg::RegKey;

const RUN_KEY_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_REG_NAME: &str = "MorningTV";
const GITHUB_REPO_URL: &str = "https://github.com/morningstarwebd/morningtv";

/// Checks if MorningTV is registered to launch at Windows startup
pub fn is_autostart_enabled() -> bool {
    #[cfg(windows)]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey_with_flags(RUN_KEY_PATH, KEY_READ) {
            let res: Result<String, _> = key.get_value(APP_REG_NAME);
            return res.is_ok();
        }
    }
    false
}

/// Enables or disables Windows startup autostart in HKCU Run registry
pub fn set_autostart_enabled(enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if enabled {
            let (key, _) = hkcu
                .create_subkey(RUN_KEY_PATH)
                .map_err(|e| format!("Failed to access HKCU Run registry: {e}"))?;
            let current_exe = std::env::current_exe()
                .map_err(|e| format!("Failed to resolve executable path: {e}"))?;
            let quoted_exe = format!("\"{}\"", current_exe.to_string_lossy());
            key.set_value(APP_REG_NAME, &quoted_exe)
                .map_err(|e| format!("Failed to set autostart registry entry: {e}"))?;
            tracing::info!("Registered Windows autostart entry: {}", quoted_exe);
            Ok(true)
        } else {
            if let Ok(key) = hkcu.open_subkey_with_flags(RUN_KEY_PATH, KEY_WRITE) {
                let _ = key.delete_value(APP_REG_NAME);
            }
            tracing::info!("Removed Windows autostart entry");
            Ok(false)
        }
    }
    #[cfg(not(windows))]
    Ok(false)
}

/// Opens GitHub repository in default browser
pub fn open_github_repo() {
    tracing::info!("Opening GitHub repository: {}", GITHUB_REPO_URL);
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", GITHUB_REPO_URL])
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(GITHUB_REPO_URL)
            .spawn();
    }
}

/// Sets up the Windows System Tray icon, menu, and event handlers
pub fn setup_tray(app: &AppHandle, shared_state: crate::app::SharedAppState) -> Result<(), Box<dyn std::error::Error>> {
    let autostart_init = is_autostart_enabled();

    // Build Tray Menu Items
    let title_item = MenuItemBuilder::with_id("title", "MorningTV Live TV v1.0.1")
        .enabled(false)
        .build(app)?;

    let show_hide_item = MenuItemBuilder::with_id("toggle_window", "📺 Show / Hide MorningTV")
        .build(app)?;

    let autostart_item = CheckMenuItemBuilder::with_id("toggle_autostart", "🚀 Start with Windows (Auto-boot)")
        .checked(autostart_init)
        .build(app)?;

    let github_item = MenuItemBuilder::with_id("github", "🌐 Open GitHub Repository")
        .build(app)?;

    let refresh_item = MenuItemBuilder::with_id("refresh_streams", "🔄 Reload Verified Playlist")
        .build(app)?;

    let quit_item = MenuItemBuilder::with_id("quit", "❌ Quit MorningTV")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&title_item)
        .separator()
        .item(&show_hide_item)
        .separator()
        .item(&autostart_item)
        .item(&github_item)
        .item(&refresh_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let mut tray_builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("MorningTV - Native Windows Live TV Player");

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    let state_for_menu = Arc::clone(&shared_state);
    let app_handle_for_menu = app.clone();

    let _tray = tray_builder
        .on_menu_event(move |app_handle, event| {
            let id = event.id.as_ref();
            match id {
                "toggle_window" => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if let Ok(is_visible) = window.is_visible() {
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
                "toggle_autostart" => {
                    let current = is_autostart_enabled();
                    let new_state = !current;
                    let _ = set_autostart_enabled(new_state);
                    tracing::info!("Tray toggled Windows autostart: {}", new_state);
                }
                "github" => {
                    open_github_repo();
                }
                "refresh_streams" => {
                    let state = Arc::clone(&state_for_menu);
                    let app_h = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let url = {
                            let guard = state.read().await;
                            guard.settings.playlist_url.clone()
                        };
                        let mut guard = state.write().await;
                        let _ = guard.load_playlist(&url).await;
                        tracing::info!("Tray triggered stream playlist refresh");
                        if let Some(window) = app_h.get_webview_window("main") {
                            let _ = window.emit("playlist_refreshed", ());
                        }
                    });
                }
                "quit" => {
                    tracing::info!("User initiated Quit via Tray icon");
                    crate::network::StreamProxy::shutdown();
                    let state = Arc::clone(&state_for_menu);
                    tauri::async_runtime::spawn(async move {
                        let guard = state.read().await;
                        guard.checkpoint();
                    });
                    app_handle_for_menu.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(is_visible) = window.is_visible() {
                        if is_visible {
                            let _ = window.set_focus();
                        } else {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        })
        .build(app)?;

    tracing::info!("Windows System Tray successfully initialized with Quick Controls");
    Ok(())
}
