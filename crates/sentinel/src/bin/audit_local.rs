// crates/sentinel/src/bin/audit_local.rs
// High-Speed Real-World Stream Audit Tool for MorningTV Playlists
// Tests 100% of channels in playlists/morningtv_all.m3u concurrently on the user's live connection.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Semaphore;

use sentinel::{parse_m3u, probe_single_url};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("===============================================================");
    println!("🔍 MorningTV Live Local Network Channel Audit");
    println!("   Real-World Stream Verifier on User's Active Connection");
    println!("===============================================================\n");

    let playlist_path = if Path::new("playlists/morningtv_all.m3u").exists() {
        PathBuf::from("playlists/morningtv_all.m3u")
    } else if Path::new("../../playlists/morningtv_all.m3u").exists() {
        PathBuf::from("../../playlists/morningtv_all.m3u")
    } else {
        eprintln!("❌ Error: playlists/morningtv_all.m3u not found!");
        return Ok(());
    };

    println!("📖 Reading playlist from {:?}...", playlist_path);
    let content = fs::read_to_string(&playlist_path)?;
    let channels = parse_m3u(&content, "General", "LocalAudit", false);
    let total_channels = channels.len();

    println!("📊 Total channels found in master playlist: {}\n", total_channels);

    // Initialize HTTP client tuned for rapid concurrent probing on cellular/broadband connection
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .connect_timeout(std::time::Duration::from_secs(3))
        .redirect(reqwest::redirect::Policy::limited(4))
        .pool_max_idle_per_host(40)
        .tcp_keepalive(std::time::Duration::from_secs(15))
        .build()?;
    let client = Arc::new(client);

    // Determine concurrency based on CPU logical cores (AMD Ryzen 7 4800H = 16 threads)
    let num_cpus = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(8);
    let workers = (num_cpus * 4).clamp(32, 80);
    let semaphore = Arc::new(Semaphore::new(workers));

    let completed = Arc::new(AtomicUsize::new(0));
    let primary_live = Arc::new(AtomicUsize::new(0));
    let mirror_live = Arc::new(AtomicUsize::new(0));
    let dead_count = Arc::new(AtomicUsize::new(0));
    let total_latency = Arc::new(AtomicUsize::new(0));

    println!(
        "🚀 Launching {} concurrent workers across {} CPU threads...",
        workers, num_cpus
    );
    println!("⏳ Testing all {} channels (this takes ~60-90s)...\n", total_channels);

    let audit_start = Instant::now();
    let mut tasks = Vec::with_capacity(total_channels);

    for ch in channels {
        let sem = Arc::clone(&semaphore);
        let cli = Arc::clone(&client);
        let comp = Arc::clone(&completed);
        let p_live = Arc::clone(&primary_live);
        let m_live = Arc::clone(&mirror_live);
        let d_count = Arc::clone(&dead_count);
        let t_lat = Arc::clone(&total_latency);

        let task = tokio::spawn(async move {
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return,
            };

            // 1. Probe primary URL
            let primary_res = probe_single_url(&cli, &ch.url).await;

            if primary_res.ok {
                p_live.fetch_add(1, Ordering::Relaxed);
                t_lat.fetch_add(primary_res.latency_ms as usize, Ordering::Relaxed);
            } else if !ch.fallbacks.is_empty() {
                // 2. If primary failed, test fallback mirrors
                let mut mirror_worked = false;
                for fb in &ch.fallbacks {
                    let fb_res = probe_single_url(&cli, fb).await;
                    if fb_res.ok {
                        m_live.fetch_add(1, Ordering::Relaxed);
                        t_lat.fetch_add(fb_res.latency_ms as usize, Ordering::Relaxed);
                        mirror_worked = true;
                        break;
                    }
                }
                if !mirror_worked {
                    d_count.fetch_add(1, Ordering::Relaxed);
                }
            } else {
                d_count.fetch_add(1, Ordering::Relaxed);
            }

            let done = comp.fetch_add(1, Ordering::Relaxed) + 1;
            if done % 250 == 0 || done == total_channels {
                let p = p_live.load(Ordering::Relaxed);
                let m = m_live.load(Ordering::Relaxed);
                let d = d_count.load(Ordering::Relaxed);
                let pct = (done as f64 / total_channels as f64) * 100.0;
                let active = p + m;
                let active_pct = if done > 0 { (active as f64 / done as f64) * 100.0 } else { 0.0 };
                print!(
                    "\r   Progress: {:5}/{} ({:5.1}%) | Live: {:5} ({:4.1}%) [Primary: {}, Mirror: {}] | Offline: {:5}",
                    done, total_channels, pct, active, active_pct, p, m, d
                );
            }
        });

        tasks.push(task);
    }

    for t in tasks {
        let _ = t.await;
    }

    let elapsed = audit_start.elapsed();
    println!("\n");

    let p = primary_live.load(Ordering::Relaxed);
    let m = mirror_live.load(Ordering::Relaxed);
    let d = dead_count.load(Ordering::Relaxed);
    let total_active = p + m;
    let success_rate = (total_active as f64 / total_channels as f64) * 100.0;
    let avg_latency = if total_active > 0 {
        total_latency.load(Ordering::Relaxed) as f64 / total_active as f64
    } else {
        0.0
    };

    println!("===============================================================");
    println!("📈 LOCAL NETWORK REAL-WORLD AUDIT REPORT");
    println!("===============================================================");
    println!("⏱️  Total Audit Duration:       {:.2} seconds", elapsed.as_secs_f64());
    println!("📡 Total Channels Tested:       {}", total_channels);
    println!("✅ 100% Playable Right Now:     {} ({:.1}%)", total_active, success_rate);
    println!("   └─ Primary URLs Working:     {} ({:.1}%)", p, (p as f64 / total_channels as f64) * 100.0);
    println!("   └─ Healed via Backup Mirror: {} ({:.1}%)", m, (m as f64 / total_channels as f64) * 100.0);
    println!("❌ Dead / Blocked on Connection: {} ({:.1}%)", d, (d as f64 / total_channels as f64) * 100.0);
    println!("⚡ Average Stream Latency:      {:.0} ms", avg_latency);
    println!("===============================================================\n");

    Ok(())
}
