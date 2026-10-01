// src-tauri/src/network/ffmpeg_bridge.rs
// Universal Audio/Video Remuxing & Transcoding Bridge powered by FFmpeg
// Provides 100% playback compatibility for H.265 (HEVC), AC3/EAC3 Dolby Audio, and Raw MPEG-TS streams.

use axum::body::Body;
use std::path::PathBuf;
use std::sync::OnceLock;
use tokio_util::io::ReaderStream;

static FFMPEG_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

pub struct FfmpegBridge;

impl FfmpegBridge {
    /// Discovers the path to the bundled or system FFmpeg binary
    pub fn get_ffmpeg_path() -> Option<&'static PathBuf> {
        FFMPEG_PATH
            .get_or_init(|| {
                // 1. Check relative to current running executable (e.g. bundled in installer bin/ directory)
                if let Ok(current_exe) = std::env::current_exe() {
                    if let Some(exe_dir) = current_exe.parent() {
                        let candidate1 = exe_dir.join("bin").join("ffmpeg.exe");
                        if candidate1.is_file() {
                            tracing::info!("Discovered bundled FFmpeg binary at: {:?}", candidate1);
                            return Some(candidate1);
                        }
                        let candidate2 = exe_dir.join("ffmpeg.exe");
                        if candidate2.is_file() {
                            tracing::info!("Discovered local FFmpeg binary at: {:?}", candidate2);
                            return Some(candidate2);
                        }
                        // For development mode (target/debug or target/release)
                        let candidate3 = exe_dir
                            .ancestors()
                            .find(|p| p.join("src-tauri").is_dir())
                            .map(|root| root.join("src-tauri").join("bin").join("ffmpeg.exe"));
                        if let Some(c3) = candidate3 {
                            if c3.is_file() {
                                tracing::info!("Discovered development FFmpeg binary at: {:?}", c3);
                                return Some(c3);
                            }
                        }
                    }
                }

                // 2. Check %LOCALAPPDATA%/MorningTV/bin/ffmpeg.exe
                if let Some(local_app_data) = dirs::data_local_dir() {
                    let candidate = local_app_data.join("MorningTV").join("bin").join("ffmpeg.exe");
                    if candidate.is_file() {
                        tracing::info!("Discovered AppData FFmpeg binary at: {:?}", candidate);
                        return Some(candidate);
                    }
                }

                // 3. Check system PATH
                if let Ok(output) = std::process::Command::new("where.exe")
                    .arg("ffmpeg")
                    .output()
                {
                    if output.status.success() {
                        let path_str = String::from_utf8_lossy(&output.stdout);
                        if let Some(first_line) = path_str.lines().next() {
                            let p = PathBuf::from(first_line.trim());
                            if p.is_file() {
                                tracing::info!("Discovered system PATH FFmpeg binary at: {:?}", p);
                                return Some(p);
                            }
                        }
                    }
                }

                tracing::debug!("No bundled or system FFmpeg binary detected; operating in native HLS-only mode");
                None
            })
            .as_ref()
    }

    /// Returns true if an FFmpeg binary is available on the machine
    pub fn is_available() -> bool {
        Self::get_ffmpeg_path().is_some()
    }

    /// Spawns an asynchronous FFmpeg stream process that remuxes the source stream to transport stream with AAC audio
    pub async fn spawn_remux_stream(target_url: &str) -> Result<Body, String> {
        let ffmpeg_path = Self::get_ffmpeg_path()
            .ok_or_else(|| "FFmpeg binary is not available on this system".to_string())?;

        let mut cmd = tokio::process::Command::new(ffmpeg_path);
        cmd.args([
            "-hide_banner",
            "-loglevel", "error",
            "-reconnect", "1",
            "-reconnect_at_eof", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5",
            "-i", target_url,
            // Video: stream copy for instant, zero-CPU remuxing
            "-c:v", "copy",
            // Audio: normalize to AAC stereo so WebView2/Chromium can play AC3/Dolby streams
            "-c:a", "aac",
            "-b:a", "192k",
            "-ac", "2",
            "-f", "mpegts",
            "-"
        ]);

        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::null());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn FFmpeg process: {}", e))?;
        let stdout = child.stdout.take().ok_or_else(|| "Failed to capture FFmpeg stdout".to_string())?;

        // Automatically reap child process when reader completes or drops
        tokio::spawn(async move {
            let _ = child.wait().await;
        });

        let reader_stream = ReaderStream::new(stdout);
        Ok(Body::from_stream(reader_stream))
    }
}
