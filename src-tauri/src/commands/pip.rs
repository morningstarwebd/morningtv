// src-tauri/src/commands/pip.rs
// Native floating Picture-in-Picture window management via Tauri v2 WebviewWindow APIs

#[tauri::command]
pub async fn toggle_native_pip(window: tauri::WebviewWindow, is_pip: bool) -> Result<bool, String> {
    if is_pip {
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window.set_size(tauri::LogicalSize::new(420.0, 240.0)).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_size(tauri::LogicalSize::new(1280.0, 720.0)).map_err(|e| e.to_string())?;
        Ok(false)
    }
}
