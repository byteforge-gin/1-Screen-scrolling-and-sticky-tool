pub mod commands;
pub mod cursor_poller;
pub mod models;
pub mod store;
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
            cursor_poller::start_cursor_polling(app.handle().clone());
            Ok(())
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
