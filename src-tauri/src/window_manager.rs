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
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        window
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        let url = WebviewUrl::App(format!("/#/overlay/{}", id).into());
        WebviewWindowBuilder::new(app, &label, url)
            .title(format!("Overlay {}", id))
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .position(x, y)
            .inner_size(width, height)
            .build()
            .map_err(|e| e.to_string())?;
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
