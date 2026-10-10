// src/lib.rs
// MorningTV Tauri application initialization and command registration

pub mod app;
pub mod commands;
pub mod config;
pub mod domain;
pub mod error;
pub mod logging;
pub mod network;
pub mod playlist;
pub mod storage;
pub mod tray;

use app::{AppState, SharedAppState};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Task 2.1: Initialize structured tracing and file logging
    logging::init_logging();
    tracing::info!("Initializing MorningTV backend core");

    let state: SharedAppState = Arc::new(RwLock::new(AppState::new().expect("Failed to initialize AppState")));

    // Start local streaming proxy to eliminate CORS & bypass User-Agent blocks
    network::StreamProxy::start();

    // Initial load of default playlist
    let state_for_load = Arc::clone(&state);
    tauri::async_runtime::spawn(async move {
        let playlist_url = {
            let guard = state_for_load.read().await;
            guard.settings.playlist_url.clone()
        };
        let mut guard = state_for_load.write().await;
        let _ = guard.load_playlist(&playlist_url).await;
    });

    let state_for_close = Arc::clone(&state);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup({
            let state_for_tray = Arc::clone(&state);
            move |app| {
                if let Err(e) = tray::setup_tray(app.handle(), state_for_tray) {
                    tracing::error!("Failed to initialize tray: {e}");
                }

                // In production release mode: ensure Webview2 DevTools remain closed
                #[cfg(not(debug_assertions))]
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.close_devtools();
                }

                Ok(())
            }
        })
        .on_window_event(move |_window, event| {
            // Task 3.1 & 3.2: Graceful proxy shutdown, SQLite WAL checkpoint, and complete process termination on close
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if _window.label() == "main" {
                    tracing::info!("Main window close requested; shutting down streaming proxy, checkpointing DB, and terminating application cleanly");
                    network::StreamProxy::shutdown();
                    let state_clone = Arc::clone(&state_for_close);
                    tauri::async_runtime::spawn(async move {
                        let guard = state_clone.read().await;
                        guard.checkpoint();
                    });
                    if let Some(yt) = _window.app_handle().get_webview_window("youtube") {
                        let _ = yt.close();
                    }
                    if let Some(hs) = _window.app_handle().get_webview_window("hotstar") {
                        let _ = hs.close();
                    }
                    _window.app_handle().exit(0);
                }
            }
        })
        .manage(state)
        .manage(commands::NetworkMonitorState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_channels,
            commands::get_total_channel_count,
            commands::get_categories,
            commands::select_channel,
            commands::toggle_favorite,
            commands::set_category,
            commands::search_channels,
            commands::load_playlist,
            commands::get_settings,
            commands::save_settings,
            commands::cycle_quality,
            commands::get_system_network_stats,
            commands::get_proxy_metrics,
            commands::log_frontend_error,
            commands::open_youtube,
            commands::open_hotstar,
            commands::reset_playlist,
            commands::force_refresh_channels,
            commands::check_playlist_update,
            commands::background_refresh_playlist,
            commands::get_proxy_auth_token,
            commands::get_proxy_port,
            commands::check_ffmpeg_status,
            commands::heal_channel,
            commands::toggle_native_pip,
            commands::get_channel_epg,
            commands::get_startup_status,
            commands::set_startup_status,
            commands::open_github_url,
            commands::toggle_devtools,
            commands::test_groq_api_key,
            commands::add_custom_upstream_source,
            commands::remove_custom_upstream_source,
            commands::ask_ai_assistant,
            commands::ai_voice_chat,
            commands::ai_hunt_and_heal,
            commands::verify_ai_provider_key,
            commands::fetch_ai_provider_models,
            commands::set_active_ai_model,
            commands::ai_diagnose_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

