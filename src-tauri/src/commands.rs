use crate::models::AppState;
use crate::store;
use crate::window_manager;
use tauri::AppHandle;

#[tauri::command]
pub fn load_panels(app: AppHandle) -> Result<AppState, String> {
    let path = store::get_storage_path(&app)?;
    store::load_state_from_file(&path)
}

#[tauri::command]
pub fn save_panels(app: AppHandle, state: AppState) -> Result<(), String> {
    let path = store::get_storage_path(&app)?;
    store::save_state_to_file(&path, &state)
}

#[tauri::command]
pub fn open_or_focus_overlay(
    app: AppHandle,
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    window_manager::open_or_focus_overlay(&app, &id, x, y, width, height)
}

#[tauri::command]
pub fn close_overlay(app: AppHandle, id: String) -> Result<(), String> {
    window_manager::close_overlay(&app, &id)
}
