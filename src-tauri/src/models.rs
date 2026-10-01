use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PanelPosition {
    pub x: f64,
    pub y: f64,
}

impl Default for PanelPosition {
    fn default() -> Self {
        Self { x: 100.0, y: 100.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PanelSize {
    pub width: f64,
    pub height: f64,
}

impl Default for PanelSize {
    fn default() -> Self {
        Self {
            width: 400.0,
            height: 120.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PanelStyle {
    pub font_size: f64,
    pub font_color: String,
    pub font_weight: String,
    pub font_style: String,
    pub bg_color: String,
    pub bg_opacity: f64,
    pub text_align: String,
    pub text_shadow: bool,
}

impl Default for PanelStyle {
    fn default() -> Self {
        Self {
            font_size: 24.0,
            font_color: "#ffffff".to_string(),
            font_weight: "normal".to_string(),
            font_style: "normal".to_string(),
            bg_color: "#000000".to_string(),
            bg_opacity: 0.5,
            text_align: "left".to_string(),
            text_shadow: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PanelScroll {
    pub mode: String,
    pub speed: f64,
    #[serde(rename = "loop")]
    pub loop_: bool,
    pub paused: bool,
}

impl Default for PanelScroll {
    fn default() -> Self {
        Self {
            mode: "horizontal".to_string(),
            speed: 50.0,
            loop_: true,
            paused: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PanelConfig {
    pub id: String,
    pub name: String,
    pub text: String,
    pub position: PanelPosition,
    pub size: PanelSize,
    pub style: PanelStyle,
    pub scroll: PanelScroll,
    pub visible: bool,
}

impl Default for PanelConfig {
    fn default() -> Self {
        Self {
            id: "default-panel".to_string(),
            name: "新建面板".to_string(),
            text: "欢迎使用屏幕滚动便签".to_string(),
            position: PanelPosition::default(),
            size: PanelSize::default(),
            style: PanelStyle::default(),
            scroll: PanelScroll::default(),
            visible: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub panels: Vec<PanelConfig>,
    pub global_paused: bool,
    pub hotkey: String,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            panels: vec![PanelConfig::default()],
            global_paused: false,
            hotkey: "Ctrl+Alt+Space".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serde_camel_case_json() {
        let state = AppState::default();
        let json = serde_json::to_string(&state).expect("serialize");
        
        assert!(json.contains("\"globalPaused\":false"));
        assert!(json.contains("\"fontSize\":24.0"));
        assert!(json.contains("\"loop\":true"));
        assert!(json.contains("\"bgColor\":\"#000000\""));

        let deserialized: AppState = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(state, deserialized);
    }

    #[test]
    fn test_deserialize_frontend_payload() {
        let frontend_json = r##"{
            "panels": [
                {
                    "id": "test-uuid-123",
                    "name": "测试面板",
                    "text": "测试内容",
                    "position": { "x": 120.5, "y": 200.0 },
                    "size": { "width": 500.0, "height": 150.0 },
                    "style": {
                        "fontSize": 28.0,
                        "fontColor": "#ff0000",
                        "fontWeight": "bold",
                        "fontStyle": "italic",
                        "bgColor": "#111111",
                        "bgOpacity": 0.8,
                        "textAlign": "center",
                        "textShadow": true
                    },
                    "scroll": {
                        "mode": "vertical",
                        "speed": 75.0,
                        "loop": false,
                        "paused": true
                    },
                    "visible": true
                }
            ],
            "globalPaused": true,
            "hotkey": "Ctrl+Shift+P"
        }"##;

        let parsed: AppState = serde_json::from_str(frontend_json).expect("should parse frontend json");
        assert_eq!(parsed.panels.len(), 1);
        let p = &parsed.panels[0];
        assert_eq!(p.id, "test-uuid-123");
        assert_eq!(p.style.font_size, 28.0);
        assert_eq!(p.style.font_weight, "bold");
        assert_eq!(p.style.text_shadow, true);
        assert_eq!(p.scroll.mode, "vertical");
        assert_eq!(p.scroll.loop_, false);
        assert_eq!(p.scroll.paused, true);
        assert_eq!(parsed.global_paused, true);
        assert_eq!(parsed.hotkey, "Ctrl+Shift+P");
    }
}
