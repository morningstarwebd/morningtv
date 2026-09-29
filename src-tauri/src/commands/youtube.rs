// src-tauri/src/commands/youtube.rs
// Commands to open official YouTube and JioHotstar in unified native window with sleek top navigation.
//
// LEGAL & COMPLIANCE NOTICE:
// MorningTV only displays official third-party websites inside standard WebViews for user convenience.
// MorningTV does NOT host, redistribute, modify, scrape, or circumvent DRM/access controls of these services.
// All trademarks, copyrights, and intellectual property belong to their respective owners (Google LLC, Disney+ Hotstar).

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const NAV_SCRIPT_TEMPLATE: &str = r##"
(function() {
    if (window.__morningtv_nav_active) return;
    window.__morningtv_nav_active = true;

    function buildNav() {
        if (document.getElementById('morningtv-top-strip')) return;
        const parent = document.body || document.documentElement;
        if (!parent) return;

        const isYT = window.location.hostname.includes('youtube.com');

        // Style container
        const strip = document.createElement('div');
        strip.id = 'morningtv-top-strip';
        strip.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'right: 0',
            'height: 32px',
            'background: #0f0f0f',
            'border-bottom: 1px solid rgba(255, 255, 255, 0.12)',
            'z-index: 2147483647',
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'padding: 0 10px',
            'box-sizing: border-box',
            'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'user-select: none',
            'transition: transform 0.2s ease, opacity 0.2s ease'
        ].join(';');

        // Left Section: [Brand Logo/Title] [◀ Live TV] [◀] [▶] [↻]
        const leftBox = document.createElement('div');
        leftBox.style.cssText = 'display:flex;align-items:center;gap:8px;';

        // 1. Service Brand Indicator
        const brandBox = document.createElement('div');
        brandBox.style.cssText = 'display:flex;align-items:center;gap:6px;padding-right:8px;border-right:1px solid rgba(255,255,255,0.15);';
        if (isYT) {
            brandBox.innerHTML = `
                <svg viewBox="0 0 28.57 20" style="height:14px;width:20px;display:block;">
                    <path d="M27.97 3.12C27.64 1.89 26.68 0.93 25.45 0.6 23.22 0 14.29 0 14.29 0s-8.93 0-11.16.6C1.89.93.93 1.89.6 3.12 0 5.35 0 10 0 10s0 4.65.6 6.88c.33 1.23 1.29 2.19 2.53 2.52 2.23.6 11.16.6 11.16.6s8.93 0 11.16-.6c1.23-.33 2.19-1.29 2.52-2.52.6-2.23.6-6.88.6-6.88s0-4.65-.6-6.88z" fill="#FF0000"/>
                    <path d="M11.43 14.29L18.85 10l-7.42-4.29v8.58z" fill="#FFFFFF"/>
                </svg>
                <span style="color:#ffffff;font-weight:800;font-size:12px;letter-spacing:-0.2px;">YouTube</span>
            `;
        } else {
            brandBox.innerHTML = `
                <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#6366f1);box-shadow:0 0 8px #38bdf8;"></span>
                <span style="color:#ffffff;font-weight:800;font-size:12px;letter-spacing:-0.2px;">JioHotstar</span>
            `;
        }
        leftBox.appendChild(brandBox);

        // 2. BACK TO LIVE TV BUTTON
        const btnLive = document.createElement('button');
        btnLive.id = 'morningtv-btn-live';
        btnLive.title = 'Return to MorningTV Live TV Channel Guide';
        btnLive.innerHTML = '<span style="font-size:11px;">◀</span> <span>Live TV</span>';
        btnLive.style.cssText = [
            'display: flex',
            'align-items: center',
            'gap: 5px',
            'background: linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(37, 99, 235, 0.9))',
            'border: 1px solid rgba(255, 255, 255, 0.35)',
            'color: #ffffff',
            'font-weight: 800',
            'font-size: 11px',
            'padding: 3px 10px',
            'border-radius: 6px',
            'cursor: pointer',
            'outline: none',
            'box-shadow: 0 2px 10px rgba(6, 182, 212, 0.4)',
            'transition: all 0.15s ease'
        ].join(';');
        btnLive.onmouseenter = function() {
            btnLive.style.filter = 'brightness(1.2)';
            btnLive.style.transform = 'scale(1.04)';
        };
        btnLive.onmouseleave = function() {
            btnLive.style.filter = 'none';
            btnLive.style.transform = 'scale(1)';
        };
        btnLive.onclick = function(e) {
            e.stopPropagation();
            window.location.href = 'http://127.0.0.1:__MORNINGTV_PROXY_PORT__/return_to_morningtv';
        };
        leftBox.appendChild(btnLive);

        // 3. Browser History Back Button
        const btnBack = document.createElement('button');
        btnBack.title = 'Back (History)';
        btnBack.textContent = '◀';
        btnBack.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:#ffffff;font-size:11px;padding:3px 8px;border-radius:6px;cursor:pointer;outline:none;transition:background 0.15s;';
        btnBack.onmouseenter = function() { btnBack.style.background = 'rgba(255,255,255,0.2)'; };
        btnBack.onmouseleave = function() { btnBack.style.background = 'rgba(255,255,255,0.08)'; };
        btnBack.onclick = function(e) {
            e.stopPropagation();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'http://127.0.0.1:__MORNINGTV_PROXY_PORT__/return_to_morningtv';
            }
        };
        leftBox.appendChild(btnBack);

        // 4. Browser History Forward Button
        const btnFwd = document.createElement('button');
        btnFwd.title = 'Forward (History)';
        btnFwd.textContent = '▶';
        btnFwd.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:#ffffff;font-size:11px;padding:3px 8px;border-radius:6px;cursor:pointer;outline:none;transition:background 0.15s;';
        btnFwd.onmouseenter = function() { btnFwd.style.background = 'rgba(255,255,255,0.2)'; };
        btnFwd.onmouseleave = function() { btnFwd.style.background = 'rgba(255,255,255,0.08)'; };
        btnFwd.onclick = function(e) {
            e.stopPropagation();
            window.history.forward();
        };
        leftBox.appendChild(btnFwd);

        // 5. Reload Button
        const btnReload = document.createElement('button');
        btnReload.title = 'Reload page';
        btnReload.textContent = '↻';
        btnReload.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:#ffffff;font-size:12px;padding:2px 8px;border-radius:6px;cursor:pointer;outline:none;transition:background 0.15s;';
        btnReload.onmouseenter = function() { btnReload.style.background = 'rgba(255,255,255,0.2)'; };
        btnReload.onmouseleave = function() { btnReload.style.background = 'rgba(255,255,255,0.08)'; };
        btnReload.onclick = function(e) {
            e.stopPropagation();
            window.location.reload();
        };
        leftBox.appendChild(btnReload);

        strip.appendChild(leftBox);

        // Right Section: Hint & Return to MorningTV Close button
        const rightBox = document.createElement('div');
        rightBox.style.cssText = 'display:flex;align-items:center;gap:10px;';

        const hint = document.createElement('span');
        hint.style.cssText = 'color:rgba(255,255,255,0.4);font-size:11px;font-weight:500;';
        hint.textContent = 'MorningTV View • Esc to return';
        rightBox.appendChild(hint);

        const btnClose = document.createElement('button');
        btnClose.title = 'Exit & Return to MorningTV Live TV';
        btnClose.textContent = '✕';
        btnClose.style.cssText = 'background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;cursor:pointer;outline:none;transition:all 0.15s;';
        btnClose.onmouseenter = function() { btnClose.style.background = 'rgba(239,68,68,0.4)'; btnClose.style.color = '#fff'; };
        btnClose.onmouseleave = function() { btnClose.style.background = 'rgba(239,68,68,0.2)'; btnClose.style.color = '#fca5a5'; };
        btnClose.onclick = function(e) {
            e.stopPropagation();
            window.location.href = 'http://127.0.0.1:__MORNINGTV_PROXY_PORT__/return_to_morningtv';
        };
        rightBox.appendChild(btnClose);

        strip.appendChild(rightBox);

        parent.appendChild(strip);

        // Adjust host page styling so the 32px top strip doesn't clip any web UI
        const style = document.createElement('style');
        style.id = 'morningtv-injected-style';
        style.textContent = `
            #morningtv-top-strip { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
            :fullscreen #morningtv-top-strip, :-webkit-full-screen #morningtv-top-strip { display: none !important; }
            body { margin-top: 32px !important; }
            #masthead-container { top: 32px !important; }
            #page-manager { margin-top: 32px !important; }
        `;
        document.head.appendChild(style);
    }

    // Keyboard shortcut: Esc to return to MorningTV when not typing or in fullscreen
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (document.fullscreenElement) {
                return;
            }
            const tag = document.activeElement ? document.activeElement.tagName : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) {
                document.activeElement.blur();
                return;
            }
            window.location.href = 'http://127.0.0.1:__MORNINGTV_PROXY_PORT__/return_to_morningtv';
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildNav);
    } else {
        buildNav();
    }
    setInterval(buildNav, 1500);
})();
"##;

fn is_allowed_youtube_navigation(url: &url::Url) -> bool {
    if let Some(host) = url.host_str() {
        let h = host.to_lowercase();
        h == "youtube.com"
            || h.ends_with(".youtube.com")
            || h == "youtu.be"
            || h == "google.com"
            || h.ends_with(".google.com")
            || h.ends_with(".googlevideo.com")
            || h.ends_with(".ytimg.com")
            || h.ends_with(".gstatic.com")
            || (h == "127.0.0.1" && url.path().contains("return_to_morningtv"))
    } else {
        false
    }
}

fn is_allowed_hotstar_navigation(url: &url::Url) -> bool {
    if let Some(host) = url.host_str() {
        let h = host.to_lowercase();
        h == "hotstar.com"
            || h.ends_with(".hotstar.com")
            || h == "jiohotstar.com"
            || h.ends_with(".jiohotstar.com")
            || h.ends_with(".disneyplus.com")
            || h.ends_with(".akamaized.net")
            || (h == "127.0.0.1" && url.path().contains("return_to_morningtv"))
    } else {
        false
    }
}

pub fn build_nav_script(port: u16) -> String {
    NAV_SCRIPT_TEMPLATE.replace("__MORNINGTV_PROXY_PORT__", &port.to_string())
}

#[tauri::command]
pub async fn open_youtube(app: AppHandle) -> Result<(), String> {
    if let Some(hs) = app.get_webview_window("hotstar") {
        let _ = hs.hide();
    }

    if let Some(window) = app.get_webview_window("youtube") {
        if let Some(main) = app.get_webview_window("main") {
            if let (Ok(pos), Ok(size)) = (main.outer_position(), main.inner_size()) {
                let _ = window.set_position(pos);
                let _ = window.set_size(size);
            }
            if main.is_maximized().unwrap_or(false) {
                let _ = window.maximize();
            }
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    let url = "https://www.youtube.com"
        .parse()
        .map_err(|e| format!("Invalid URL: {}", e))?;

    let app_handle = app.clone();
    let mut builder = WebviewWindowBuilder::new(&app, "youtube", WebviewUrl::External(url))
        .title("YouTube")
        .center()
        .resizable(true);

    // If main window exists, attach as parent so there is ONLY ONE unified window
    if let Some(main) = app.get_webview_window("main") {
        if let (Ok(pos), Ok(size)) = (main.outer_position(), main.inner_size()) {
            builder = builder
                .position(pos.x as f64, pos.y as f64)
                .inner_size(size.width as f64, size.height as f64);
        }
        if main.is_maximized().unwrap_or(false) {
            builder = builder.maximized(true);
        }
        builder = builder
            .parent(&main)
            .map_err(|e| format!("Failed to attach parent window: {}", e))?;
    }

    let proxy_port = crate::network::proxy::StreamProxy::get_port();
    let nav_script = build_nav_script(proxy_port);

    let window = builder
        .on_navigation(move |nav_url| {
            let s = nav_url.as_str();
            if s.contains("return_to_morningtv") || s.contains("close_window") || nav_url.scheme() == "morningtv" {
                if let Some(main) = app_handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.unminimize();
                    let _ = main.set_focus();
                }
                if let Some(yt) = app_handle.get_webview_window("youtube") {
                    let _ = yt.hide();
                }
                return false;
            }

            if !is_allowed_youtube_navigation(nav_url) {
                tracing::warn!("Blocked navigation to non-allowed domain in YouTube view: {}", s);
                return false;
            }

            true
        })
        .initialization_script(&nav_script)
        .build()
        .map_err(|e| format!("Failed to create YouTube window: {}", e))?;

    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
pub async fn open_hotstar(app: AppHandle) -> Result<(), String> {
    if let Some(yt) = app.get_webview_window("youtube") {
        let _ = yt.hide();
    }

    if let Some(window) = app.get_webview_window("hotstar") {
        if let Some(main) = app.get_webview_window("main") {
            if let (Ok(pos), Ok(size)) = (main.outer_position(), main.inner_size()) {
                let _ = window.set_position(pos);
                let _ = window.set_size(size);
            }
            if main.is_maximized().unwrap_or(false) {
                let _ = window.maximize();
            }
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    let url = "https://www.hotstar.com"
        .parse()
        .map_err(|e| format!("Invalid URL: {}", e))?;

    let app_handle = app.clone();

    // Hotstar in full unified window matching MorningTV main window size & position
    let mut builder = WebviewWindowBuilder::new(&app, "hotstar", WebviewUrl::External(url))
        .title("JioHotstar")
        .center()
        .resizable(true);

    if let Some(main) = app.get_webview_window("main") {
        if let (Ok(pos), Ok(size)) = (main.outer_position(), main.inner_size()) {
            builder = builder
                .position(pos.x as f64, pos.y as f64)
                .inner_size(size.width as f64, size.height as f64);
        }
        if main.is_maximized().unwrap_or(false) {
            builder = builder.maximized(true);
        }
        builder = builder
            .parent(&main)
            .map_err(|e| format!("Failed to attach parent window: {}", e))?;
    }

    let proxy_port = crate::network::proxy::StreamProxy::get_port();
    let nav_script = build_nav_script(proxy_port);

    let window = builder
        .on_navigation(move |nav_url| {
            let s = nav_url.as_str();
            if s.contains("return_to_morningtv") || s.contains("close_window") || nav_url.scheme() == "morningtv" {
                if let Some(main) = app_handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.unminimize();
                    let _ = main.set_focus();
                }
                if let Some(hs) = app_handle.get_webview_window("hotstar") {
                    let _ = hs.hide();
                }
                return false;
            }

            if !is_allowed_hotstar_navigation(nav_url) {
                tracing::warn!("Blocked navigation to non-allowed domain in Hotstar view: {}", s);
                return false;
            }

            true
        })
        .initialization_script(&nav_script)
        .build()
        .map_err(|e| format!("Failed to create JioHotstar window: {}", e))?;

    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

