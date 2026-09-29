// src-tauri/src/logging.rs
// Structured tracing and rolling file logging setup for MorningTV

use std::path::PathBuf;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static LOG_GUARD: std::sync::OnceLock<WorkerGuard> = std::sync::OnceLock::new();

pub fn get_log_dir() -> PathBuf {
    dirs::data_dir()
        .or_else(dirs::config_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(crate::config::APP_NAME)
        .join("logs")
}

pub fn init_logging() {
    let log_dir = get_log_dir();
    let _ = std::fs::create_dir_all(&log_dir);

    let file_appender = tracing_appender::rolling::daily(&log_dir, "morningtv.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    let _ = LOG_GUARD.set(guard);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,app_lib=debug,morningtv=debug,tower_http=warn,axum=info"));

    let stdout_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(true)
        .with_ansi(true);

    let file_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(true)
        .with_ansi(false)
        .with_writer(non_blocking);

    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(stdout_layer)
        .with(file_layer)
        .try_init();

    cleanup_old_logs(&log_dir);

    tracing::info!(log_dir = %log_dir.display(), "Structured tracing logger initialized");
}

/// Prunes log files older than 7 days to prevent unbounded disk usage
fn cleanup_old_logs(log_dir: &std::path::Path) {
    let retention_period = std::time::Duration::from_secs(7 * 24 * 3600);
    let now = std::time::SystemTime::now();

    if let Ok(entries) = std::fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(age) = now.duration_since(modified) {
                            if age > retention_period {
                                let _ = std::fs::remove_file(&path);
                            }
                        }
                    }
                }
            }
        }
    }
}
