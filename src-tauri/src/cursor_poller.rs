use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Hit test checking if a point `(px, py)` falls within the rectangle `(rx, ry, rw, rh)`
/// extended outward by `padding` pixels in every direction.
pub fn is_point_in_rect_with_padding(
    px: i32,
    py: i32,
    rx: i32,
    ry: i32,
    rw: u32,
    rh: u32,
    padding: i32,
) -> bool {
    px >= rx - padding
        && px <= rx + (rw as i32) + padding
        && py >= ry - padding
        && py <= ry + (rh as i32) + padding
}

/// Payload emitted for the `overlay:hover-state` event.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HoverStatePayload {
    pub id: String,
    #[serde(alias = "is_hovered")]
    pub is_hovered: bool,
}

/// Fetch global cursor position using platform-specific OS APIs via `mouse_position`.
pub fn get_cursor_position() -> Option<(i32, i32)> {
    match mouse_position::mouse_position::Mouse::get_mouse_position() {
        mouse_position::mouse_position::Mouse::Position { x, y } => Some((x, y)),
        mouse_position::mouse_position::Mouse::Error => None,
    }
}

/// Pure state tracker for managing overlay hover transitions and manual locks.
#[derive(Debug, Default)]
pub struct CursorPollerState {
    /// Maps overlay window id to its current hover state.
    pub hover_states: HashMap<String, bool>,
    /// Set of overlay window ids locked in interactive mode (e.g. dragging or quick edit).
    pub interactive_locks: HashSet<String>,
}

impl CursorPollerState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Evaluates hover status for a window and determines whether an IPC/event update is needed.
    /// Returns `Some(new_hover_state)` if state changed and needs to be applied, or `None` if no change.
    pub fn evaluate_window(&mut self, id: &str, is_cursor_in_hotzone: bool) -> Option<bool> {
        let is_locked = self.interactive_locks.contains(id);
        let effective_hover = is_locked || is_cursor_in_hotzone;
        let previous = self.hover_states.get(id).copied();

        match previous {
            Some(prev) if prev == effective_hover => None,
            _ => {
                self.hover_states.insert(id.to_string(), effective_hover);
                Some(effective_hover)
            }
        }
    }

    /// Sets or clears an interactive lock (e.g. while dragging or editing).
    /// Returns `Some(new_hover_state)` if state changed, or `None` if already matching.
    pub fn set_interactive_lock(
        &mut self,
        id: &str,
        locked: bool,
        is_cursor_in_hotzone: bool,
    ) -> Option<bool> {
        if locked {
            self.interactive_locks.insert(id.to_string());
            let previous = self.hover_states.get(id).copied();
            if previous != Some(true) {
                self.hover_states.insert(id.to_string(), true);
                Some(true)
            } else {
                None
            }
        } else {
            self.interactive_locks.remove(id);
            let effective_hover = is_cursor_in_hotzone;
            let previous = self.hover_states.get(id).copied();
            if previous != Some(effective_hover) {
                self.hover_states.insert(id.to_string(), effective_hover);
                Some(effective_hover)
            } else {
                None
            }
        }
    }

    /// Removes tracking entries for overlay windows that no longer exist.
    pub fn retain_active_windows(&mut self, active_ids: &HashSet<String>) {
        self.hover_states.retain(|id, _| active_ids.contains(id));
        self.interactive_locks.retain(|id| active_ids.contains(id));
    }
}

/// Tauri managed state wrapper holding `CursorPollerState` and a running flag.
pub struct PollerState {
    pub inner: Mutex<CursorPollerState>,
    pub running: Arc<AtomicBool>,
}

impl Default for PollerState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(CursorPollerState::default()),
            running: Arc::new(AtomicBool::new(true)),
        }
    }
}

/// Checks whether the global cursor is currently hovering within an overlay window's bounds (+12px padding).
pub fn check_window_hover(window: &WebviewWindow) -> Option<bool> {
    if !window.is_visible().unwrap_or(false) {
        return Some(false);
    }
    let (raw_x, raw_y) = get_cursor_position()?;
    let pos = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let scale = window.scale_factor().unwrap_or(1.0);

    #[cfg(target_os = "macos")]
    let (cur_x, cur_y) = (
        (raw_x as f64 * scale).round() as i32,
        (raw_y as f64 * scale).round() as i32,
    );
    #[cfg(not(target_os = "macos"))]
    let (cur_x, cur_y) = (raw_x, raw_y);

    let padding = (12.0 * scale).round() as i32;

    Some(is_point_in_rect_with_padding(
        cur_x,
        cur_y,
        pos.x,
        pos.y,
        size.width,
        size.height,
        padding,
    ))
}

/// Executes a single polling tick across all active `overlay_*` windows.
pub fn poll_cursor_tick(app: &AppHandle) {
    let poller_state = match app.try_state::<PollerState>() {
        Some(s) => s,
        None => return,
    };

    let Some(raw_cursor) = get_cursor_position() else {
        return;
    };

    let windows = app.webview_windows();
    let mut active_ids = HashSet::new();
    let mut updates = Vec::new();

    {
        let mut state = match poller_state.inner.lock() {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to lock cursor poller state: {}", e);
                return;
            }
        };

        for (label, window) in &windows {
            let Some(id) = label.strip_prefix("overlay_") else {
                continue;
            };

            active_ids.insert(id.to_string());

            let is_visible = window.is_visible().unwrap_or(false);
            let is_in_hotzone = if is_visible {
                let Ok(pos) = window.outer_position() else {
                    continue;
                };
                let Ok(size) = window.outer_size() else {
                    continue;
                };
                let scale = window.scale_factor().unwrap_or(1.0);

                #[cfg(target_os = "macos")]
                let (cur_x, cur_y) = (
                    (raw_cursor.0 as f64 * scale).round() as i32,
                    (raw_cursor.1 as f64 * scale).round() as i32,
                );
                #[cfg(not(target_os = "macos"))]
                let (cur_x, cur_y) = (raw_cursor.0, raw_cursor.1);

                let padding = (12.0 * scale).round() as i32;

                is_point_in_rect_with_padding(
                    cur_x,
                    cur_y,
                    pos.x,
                    pos.y,
                    size.width,
                    size.height,
                    padding,
                )
            } else {
                false
            };

            if let Some(new_hover) = state.evaluate_window(id, is_in_hotzone) {
                updates.push((id.to_string(), window.clone(), new_hover));
            }
        }

        state.retain_active_windows(&active_ids);
    }

    // Apply updates outside the lock to avoid holding the mutex during OS IPC and event emitting
    for (id, window, is_hovered) in updates {
        let ignore_cursor = !is_hovered;
        if let Err(e) = window.set_ignore_cursor_events(ignore_cursor) {
            log::warn!(
                "Failed to set ignore_cursor_events for overlay {}: {}",
                id,
                e
            );
        }
        if let Err(e) = app.emit(
            "overlay:hover-state",
            HoverStatePayload {
                id,
                is_hovered,
            },
        ) {
            log::warn!("Failed to emit overlay:hover-state: {}", e);
        }
    }
}

/// Spawns the global cursor polling thread that runs every 60ms.
pub fn start_cursor_polling(app: AppHandle) {
    if app.try_state::<PollerState>().is_none() {
        app.manage(PollerState::default());
    }

    let poller_state = app.state::<PollerState>();
    let running = Arc::clone(&poller_state.running);

    std::thread::Builder::new()
        .name("cursor-poller".into())
        .spawn(move || {
            while running.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(60));
                poll_cursor_tick(&app);
            }
        })
        .expect("Failed to spawn cursor poller thread");
}

/// Command handler to manually lock or unlock cursor interactivity for an overlay window.
/// Used by the frontend while dragging or during quick-edit popover interactions.
pub fn set_overlay_ignore_cursor(
    app: &AppHandle,
    id: &str,
    ignore: bool,
) -> Result<(), String> {
    let label = format!("overlay_{}", id);
    let window = app.get_webview_window(&label);

    let poller_state = app
        .try_state::<PollerState>()
        .ok_or_else(|| "Cursor poller state not initialized".to_string())?;

    let is_cursor_in_hotzone = if let Some(win) = &window {
        check_window_hover(win).unwrap_or(false)
    } else {
        false
    };

    let should_hover = {
        let mut state = poller_state
            .inner
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        state.set_interactive_lock(id, !ignore, is_cursor_in_hotzone)
    };

    if let Some(is_hovered) = should_hover {
        if let Some(win) = &window {
            win.set_ignore_cursor_events(!is_hovered)
                .map_err(|e| e.to_string())?;
        }
        let _ = app.emit(
            "overlay:hover-state",
            HoverStatePayload {
                id: id.to_string(),
                is_hovered,
            },
        );
    } else if let Some(win) = &window {
        let ignore_cursor = ignore && !is_cursor_in_hotzone;
        let _ = win.set_ignore_cursor_events(ignore_cursor);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_inside_rect_padding() {
        // Rect: x=100, y=100, w=200, h=100. Padding: 10
        // Effective area: x in [90, 310], y in [90, 210]

        // 1. Inside interior
        assert!(is_point_in_rect_with_padding(150, 150, 100, 100, 200, 100, 10));

        // 2. In padding zone (outside original rect, but within padding)
        assert!(is_point_in_rect_with_padding(95, 95, 100, 100, 200, 100, 10));
        assert!(is_point_in_rect_with_padding(90, 100, 100, 100, 200, 100, 10)); // exact left padding boundary
        assert!(is_point_in_rect_with_padding(310, 210, 100, 100, 200, 100, 10)); // exact bottom-right padding boundary

        // 3. Exterior points (outside padding zone)
        assert!(!is_point_in_rect_with_padding(80, 80, 100, 100, 200, 100, 10));
        assert!(!is_point_in_rect_with_padding(89, 150, 100, 100, 200, 100, 10)); // 1px left of padded zone
        assert!(!is_point_in_rect_with_padding(311, 150, 100, 100, 200, 100, 10)); // 1px right of padded zone
        assert!(!is_point_in_rect_with_padding(150, 89, 100, 100, 200, 100, 10)); // 1px above padded zone
        assert!(!is_point_in_rect_with_padding(150, 211, 100, 100, 200, 100, 10)); // 1px below padded zone
    }

    #[test]
    fn test_point_inside_rect_padding_12px() {
        // Standard overlay hotzone padding: 12px
        // Rect: x=200, y=300, w=400, h=250
        // Effective area: x in [188, 612], y in [288, 562]
        assert!(is_point_in_rect_with_padding(188, 288, 200, 300, 400, 250, 12));
        assert!(is_point_in_rect_with_padding(612, 562, 200, 300, 400, 250, 12));
        assert!(!is_point_in_rect_with_padding(187, 300, 200, 300, 400, 250, 12));
        assert!(!is_point_in_rect_with_padding(613, 300, 200, 300, 400, 250, 12));
    }

    #[test]
    fn test_hover_payload_serde() {
        let payload = HoverStatePayload {
            id: "panel-123".to_string(),
            is_hovered: true,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert_eq!(json, r#"{"id":"panel-123","isHovered":true}"#);

        // Deserializing from camelCase
        let de1: HoverStatePayload = serde_json::from_str(&json).unwrap();
        assert_eq!(de1, payload);

        // Deserializing from snake_case alias
        let json_snake = r#"{"id":"panel-123","is_hovered":true}"#;
        let de2: HoverStatePayload = serde_json::from_str(json_snake).unwrap();
        assert_eq!(de2, payload);
    }

    #[test]
    fn test_cursor_poller_state_evaluation_transitions() {
        let mut state = CursorPollerState::new();

        // 1. First evaluation: cursor is outside hotzone -> becomes false
        let r1 = state.evaluate_window("overlay-1", false);
        assert_eq!(r1, Some(false));

        // 2. Cursor stays outside -> no update (prevent OS IPC)
        let r2 = state.evaluate_window("overlay-1", false);
        assert_eq!(r2, None);

        // 3. Cursor enters hotzone -> becomes true
        let r3 = state.evaluate_window("overlay-1", true);
        assert_eq!(r3, Some(true));

        // 4. Cursor moves inside hotzone -> no redundant update
        let r4 = state.evaluate_window("overlay-1", true);
        assert_eq!(r4, None);

        // 5. Cursor leaves hotzone -> becomes false
        let r5 = state.evaluate_window("overlay-1", false);
        assert_eq!(r5, Some(false));
    }

    #[test]
    fn test_interactive_lock_prevents_pass_through() {
        let mut state = CursorPollerState::new();

        // Cursor enters hotzone
        assert_eq!(state.evaluate_window("overlay-1", true), Some(true));

        // Drag begins -> lock interactive (locked = true)
        assert_eq!(state.set_interactive_lock("overlay-1", true, true), None); // already true

        // While dragging, cursor moves outside hotzone -> because it's locked, hover stays true!
        assert_eq!(state.evaluate_window("overlay-1", false), None);
        assert_eq!(state.hover_states.get("overlay-1"), Some(&true));

        // Drag ends while cursor is outside hotzone -> lock cleared
        assert_eq!(state.set_interactive_lock("overlay-1", false, false), Some(false));
        assert_eq!(state.hover_states.get("overlay-1"), Some(&false));
    }

    #[test]
    fn test_interactive_lock_drag_ends_inside_hotzone() {
        let mut state = CursorPollerState::new();

        // Overlay active and locked interactive
        assert_eq!(state.set_interactive_lock("overlay-1", true, true), Some(true));

        // Drag ends with cursor still inside hotzone -> remains true without toggle flicker
        let res = state.set_interactive_lock("overlay-1", false, true);
        assert_eq!(res, None);
        assert_eq!(state.hover_states.get("overlay-1"), Some(&true));
    }

    #[test]
    fn test_retain_active_windows_cleans_stale_entries() {
        let mut state = CursorPollerState::new();
        state.hover_states.insert("w1".to_string(), true);
        state.hover_states.insert("w2".to_string(), false);
        state.interactive_locks.insert("w1".to_string());
        state.interactive_locks.insert("w2".to_string());

        let mut active = HashSet::new();
        active.insert("w1".to_string());

        state.retain_active_windows(&active);

        assert!(state.hover_states.contains_key("w1"));
        assert!(!state.hover_states.contains_key("w2"));
        assert!(state.interactive_locks.contains("w1"));
        assert!(!state.interactive_locks.contains("w2"));
    }
}
