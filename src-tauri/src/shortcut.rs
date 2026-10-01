use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub fn get_default_shortcut_str() -> &'static str {
    if cfg!(target_os = "macos") {
        "CommandOrControl+Alt+Space"
    } else {
        "Ctrl+Alt+Space"
    }
}

pub fn setup_global_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut_str = get_default_shortcut_str();
    let shortcut: Shortcut = shortcut_str.parse()?;
    let app_handle = app.clone();

    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = app_handle.emit("panel:toggle-global-pause", ());
        }
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_shortcut_is_valid() {
        let shortcut_str = get_default_shortcut_str();
        let parsed = shortcut_str.parse::<Shortcut>();
        assert!(parsed.is_ok(), "Default shortcut should parse successfully");
    }

    #[test]
    fn test_platform_specific_shortcuts_parse() {
        let mac_shortcut = "CommandOrControl+Alt+Space".parse::<Shortcut>();
        assert!(mac_shortcut.is_ok());

        let win_shortcut = "Ctrl+Alt+Space".parse::<Shortcut>();
        assert!(win_shortcut.is_ok());
    }
}

