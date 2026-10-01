use std::fs;
use std::path::{Path, PathBuf};

use crate::models::AppState;

pub fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;
    let target_dir = app_data_dir.join("pinmu-gundong");
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create storage directory {:?}: {}", target_dir, e))?;
    }
    Ok(target_dir.join("panels.json"))
}

pub fn load_state_from_file(path: &Path) -> Result<AppState, String> {
    if !path.exists() {
        return Ok(AppState::default());
    }

    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to read state file: {}", e)),
    };

    match serde_json::from_str::<AppState>(&content) {
        Ok(state) => Ok(state),
        Err(err) => {
            log::warn!(
                "State file at {:?} is corrupted: {}. Creating backup and loading default state.",
                path,
                err
            );
            let backup_path = path.with_extension("json.bak");
            let _ = fs::rename(path, &backup_path);
            Ok(AppState::default())
        }
    }
}

pub fn save_state_to_file(path: &Path, state: &AppState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    let serialized = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;

    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, serialized.as_bytes())
        .map_err(|e| format!("Failed to write to temp file: {}", e))?;

    fs::rename(&temp_path, path)
        .map_err(|e| format!("Failed to replace state file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_save_and_load_state() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("panels.json");
        let initial_state = AppState::default();
        save_state_to_file(&file_path, &initial_state).unwrap();

        let loaded = load_state_from_file(&file_path).unwrap();
        assert_eq!(loaded.panels.len(), initial_state.panels.len());
    }

    #[test]
    fn test_corrupted_file_recovery() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("panels.json");
        std::fs::write(&file_path, "{ invalid_json ").unwrap();

        let loaded = load_state_from_file(&file_path).unwrap();
        assert!(!loaded.panels.is_empty(), "Should recover with default panel");
        assert!(
            file_path.with_extension("json.bak").exists(),
            "Should create backup file"
        );
    }

    #[test]
    fn test_load_nonexistent_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("does_not_exist.json");
        let loaded = load_state_from_file(&file_path).unwrap();
        assert_eq!(loaded, AppState::default());
    }

    #[test]
    fn test_save_creates_parent_directories() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("nested").join("sub").join("panels.json");
        let initial_state = AppState::default();
        save_state_to_file(&file_path, &initial_state).unwrap();
        let loaded = load_state_from_file(&file_path).unwrap();
        assert_eq!(loaded.panels.len(), initial_state.panels.len());
    }
}
