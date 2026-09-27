// src/lib.rs
// NovaTV Tauri application initialization and command registration

pub mod app;
pub mod commands;
pub mod config;
pub mod domain;
pub mod error;
pub mod network;
pub mod playlist;
pub mod storage;

use app::{AppState, SharedAppState};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state: SharedAppState = Arc::new(Mutex::new(AppState::new().expect("Failed to initialize AppState")));

    // Start local streaming proxy to eliminate CORS & bypass User-Agent blocks
    network::StreamProxy::start();

    // Initial load of default playlist
    let state_for_load = Arc::clone(&state);
    tauri::async_runtime::spawn(async move {
        let playlist_url = {
            let guard = state_for_load.lock().await;
            guard.settings.playlist_url.clone()
        };
        let mut guard = state_for_load.lock().await;
        let _ = guard.load_playlist(&playlist_url).await;
    });

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .level_for("reqwest", log::LevelFilter::Warn)
                .level_for("hyper", log::LevelFilter::Warn)
                .level_for("tiny_http", log::LevelFilter::Warn)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_channels,
            commands::get_all_channels,
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
            commands::record_metrics,
            commands::get_metrics,
            commands::get_system_network_stats,
            commands::open_youtube,
            commands::open_hotstar,
            commands::focus_main_window,
            commands::reset_playlist,
            commands::force_refresh_channels,
            commands::check_playlist_update,
            commands::background_refresh_playlist,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

