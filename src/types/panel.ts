export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelStyle {
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  bgColor: string;
  bgOpacity: number;
  textAlign: 'left' | 'center' | 'right';
  textShadow: boolean;
}

export interface PanelScroll {
  mode: 'none' | 'horizontal' | 'vertical';
  speed: number;
  loop: boolean;
  paused: boolean;
}

export interface PanelConfig {
  id: string;
  name: string;
  text: string;
  position: PanelPosition;
  size: PanelSize;
  style: PanelStyle;
  scroll: PanelScroll;
  visible: boolean;
}

export interface AppState {
  panels: PanelConfig[];
  globalPaused: boolean;
  hotkey: string;
}
