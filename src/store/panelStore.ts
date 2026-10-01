import {
  PanelConfig,
  AppState,
  PanelPosition,
  PanelSize,
  PanelStyle,
  PanelScroll,
} from '../types/panel';

export type {
  PanelConfig,
  AppState,
  PanelPosition,
  PanelSize,
  PanelStyle,
  PanelScroll,
};

export type PanelAction =
  | { type: 'ADD_PANEL'; payload: PanelConfig }
  | { type: 'UPDATE_PANEL'; payload: { id: string; changes: Partial<PanelConfig> } }
  | { type: 'REMOVE_PANEL'; payload: { id: string } }
  | { type: 'TOGGLE_VISIBLE'; payload: { id: string } }
  | { type: 'TOGGLE_ALL_VISIBILITY' }
  | { type: 'TOGGLE_PAUSE'; payload: { id: string } }
  | { type: 'SET_GLOBAL_PAUSE'; payload: boolean }
  | { type: 'TOGGLE_GLOBAL_PAUSE' }
  | { type: 'SET_STATE'; payload: AppState };

export const DEFAULT_APP_STATE: AppState = {
  panels: [],
  globalPaused: false,
  hotkey: 'Ctrl+Alt+Space',
};

export function createDefaultPanel(name?: string): PanelConfig {
  return {
    id: crypto.randomUUID(),
    name: name ?? '新建面板',
    text: '欢迎使用屏幕滚动便签',
    position: {
      x: 100,
      y: 100,
    },
    size: {
      width: 400,
      height: 120,
    },
    style: {
      fontSize: 24,
      fontColor: '#ffffff',
      fontWeight: 'normal',
      fontStyle: 'normal',
      bgColor: '#000000',
      bgOpacity: 0.5,
      textAlign: 'left',
      textShadow: false,
    },
    scroll: {
      mode: 'horizontal',
      speed: 50,
      loop: true,
      paused: false,
    },
    visible: true,
  };
}

export function panelReducer(state: AppState, action: PanelAction): AppState {
  switch (action.type) {
    case 'ADD_PANEL':
      return {
        ...state,
        panels: [...state.panels, action.payload],
      };

    case 'UPDATE_PANEL':
      return {
        ...state,
        panels: state.panels.map((panel) =>
          panel.id === action.payload.id
            ? { ...panel, ...action.payload.changes }
            : panel
        ),
      };

    case 'REMOVE_PANEL':
      return {
        ...state,
        panels: state.panels.filter((panel) => panel.id !== action.payload.id),
      };

    case 'TOGGLE_VISIBLE':
      return {
        ...state,
        panels: state.panels.map((panel) =>
          panel.id === action.payload.id
            ? { ...panel, visible: !panel.visible }
            : panel
        ),
      };

    case 'TOGGLE_ALL_VISIBILITY': {
      const anyVisible = state.panels.some((panel) => panel.visible);
      const targetVisible = !anyVisible;
      return {
        ...state,
        panels: state.panels.map((panel) => ({
          ...panel,
          visible: targetVisible,
        })),
      };
    }

    case 'TOGGLE_PAUSE':
      return {
        ...state,
        panels: state.panels.map((panel) =>
          panel.id === action.payload.id
            ? {
                ...panel,
                scroll: {
                  ...panel.scroll,
                  paused: !panel.scroll.paused,
                },
              }
            : panel
        ),
      };

    case 'SET_GLOBAL_PAUSE':
      return {
        ...state,
        globalPaused: action.payload,
      };

    case 'TOGGLE_GLOBAL_PAUSE':
      return {
        ...state,
        globalPaused: !state.globalPaused,
      };

    case 'SET_STATE':
      return {
        ...action.payload,
      };

    default:
      return state;
  }
}

// Action creators
export function addPanel(panel: PanelConfig): PanelAction {
  return { type: 'ADD_PANEL', payload: panel };
}

export function updatePanel(id: string, changes: Partial<PanelConfig>): PanelAction {
  return { type: 'UPDATE_PANEL', payload: { id, changes } };
}

export function removePanel(id: string): PanelAction {
  return { type: 'REMOVE_PANEL', payload: { id } };
}

export function toggleVisible(id: string): PanelAction {
  return { type: 'TOGGLE_VISIBLE', payload: { id } };
}

export function toggleAllVisibility(): PanelAction {
  return { type: 'TOGGLE_ALL_VISIBILITY' };
}

export function togglePause(id: string): PanelAction {
  return { type: 'TOGGLE_PAUSE', payload: { id } };
}

export function setGlobalPause(paused: boolean): PanelAction {
  return { type: 'SET_GLOBAL_PAUSE', payload: paused };
}

export function toggleGlobalPause(): PanelAction {
  return { type: 'TOGGLE_GLOBAL_PAUSE' };
}

export function setState(state: AppState): PanelAction {
  return { type: 'SET_STATE', payload: state };
}
