pub mod commands;
pub mod cursor_poller;
pub mod models;
pub mod shortcut;
pub mod store;
pub mod tray;
pub mod window_manager;

pub use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
            cursor_poller::start_cursor_polling(app.handle().clone());
            tray::setup_system_tray(app.handle())?;
            if let Err(e) = shortcut::setup_global_shortcut(app.handle()) {
                log::warn!("Failed to setup global shortcut: {}", e);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_panels,
            commands::save_panels,
            commands::open_or_focus_overlay,
            commands::close_overlay,
            commands::set_overlay_ignore_cursor,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
