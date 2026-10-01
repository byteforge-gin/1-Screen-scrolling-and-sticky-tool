use tauri::webview::Color;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn open_or_focus_overlay(
    app: &AppHandle,
    id: &str,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = format!("overlay_{}", id);
    log::info!("open_or_focus_overlay: label={}, pos=({},{}), size=({}x{})", label, x, y, width, height);
    if let Some(window) = app.get_webview_window(&label) {
        log::info!("Window {} already exists, showing", label);
        window.show().map_err(|e| format!("show failed: {}", e))?;
        window
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| format!("set_position failed: {}", e))?;
        window
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| format!("set_size failed: {}", e))?;
        window.set_focus().map_err(|e| format!("set_focus failed: {}", e))?;
    } else {
        log::info!("Creating new WebviewWindow for {}", label);
        let res = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
            .title(format!("Overlay {}", id))
            .transparent(true)
            .background_color(Color(0, 0, 0, 0))
            .decorations(false)
            .always_on_top(true)
            .position(x, y)
            .inner_size(width, height)
            .build();

        match res {
            Ok(window) => {
                log::info!("Overlay window {} created successfully", label);
                let _ = window.show();
            }
            Err(e) => {
                let err_msg = format!("Failed to build overlay window {}: {:?}", label, e);
                log::error!("{}", err_msg);
                return Err(err_msg);
            }
        }
    }
    Ok(())
}

pub fn close_overlay(app: &AppHandle, id: &str) -> Result<(), String> {
    let label = format!("overlay_{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
