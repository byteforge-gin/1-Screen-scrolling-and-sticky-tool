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
        // Nudge: force an actual OS-level resize event (even when width/height
        // are unchanged) to guarantee a full repaint on Windows, working around
        // a known WebView2/DWM compositor stall on transparent layered windows
        // where plain position moves or content updates can leave a stale frame
        // visible until something forces a genuine WM_SIZE.
        #[cfg(windows)]
        {
            let _ = window.set_size(LogicalSize::new(width + 1.0, height));
            let _ = window.set_size(LogicalSize::new(width, height));
        }
        window.set_focus().map_err(|e| format!("set_focus failed: {}", e))?;
    } else {
        log::info!("Creating new WebviewWindow for {}", label);
        #[allow(unused_mut)]
        let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
            .title(format!("Overlay {}", id))
            .transparent(true)
            .background_color(Color(0, 0, 0, 0))
            .decorations(false)
            .always_on_top(true)
            .position(x, y)
            .inner_size(width, height);

        // Workaround for a known WebView2/DWM compositing bug on some Windows 10
        // configurations (certain GPU drivers / VM / RDP sessions): transparent,
        // layered, always-on-top windows can get "stuck" showing a stale frame
        // after the window is moved or its text content changes, even though a
        // resize (which forces a full repaint) still works. Forcing software
        // rendering via `--disable-gpu` avoids the stalled-compositor state.
        // A dedicated data directory is required whenever custom browser args
        // differ from the main window's defaults.
        #[cfg(windows)]
        {
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                let data_dir = app_data_dir.join("pinmu-gundong").join("webview-overlay");
                builder = builder
                    .data_directory(data_dir)
                    .additional_browser_args(
                        "--disable-gpu --disable-gpu-compositing --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
                    );
            }
        }

        let res = builder.build();

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
