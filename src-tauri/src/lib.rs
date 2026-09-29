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
        .on_window_event(move |_window, event| {
            // Task 3.1 & 3.2: Graceful proxy shutdown and SQLite WAL checkpoint on close
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                tracing::info!("Window close requested; shutting down streaming proxy and checkpointing DB");
                network::StreamProxy::shutdown();
                let state_clone = Arc::clone(&state_for_close);
                tauri::async_runtime::spawn(async move {
                    let guard = state_clone.read().await;
                    guard.checkpoint();
                });
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

