import { useReducer, useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { panelReducer, DEFAULT_APP_STATE, createDefaultPanel } from './store/panelStore';
import { AppState, PanelConfig, PanelUpdatePayload } from './types/panel';
import { MainDashboard } from './components/MainDashboard';
import { OverlayView } from './components/OverlayView';
import { useHashRoute } from './router';

interface OverlayContainerProps {
  panelId: string;
}

function OverlayContainer({ panelId }: OverlayContainerProps) {
  const [panel, setPanel] = useState<PanelConfig | null>(null);
  const panelRef = useRef<PanelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalPaused, setGlobalPaused] = useState(false);

  // Load initial panel data
  useEffect(() => {
    let isCancelled = false;
    async function loadOverlay() {
      try {
        const loaded: AppState = await invoke('load_panels');
        if (isCancelled) return;
        if (loaded && Array.isArray(loaded.panels)) {
          const found = loaded.panels.find((p) => p.id === panelId);
          if (found) {
            panelRef.current = found;
            setPanel(found);
          }
          if (typeof loaded.globalPaused === 'boolean') {
            setGlobalPaused(loaded.globalPaused);
          }
        }
      } catch {
        // Outside Tauri or load error
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }
    void loadOverlay();
    return () => {
      isCancelled = true;
    };
  }, [panelId]);

  // IPC Event Listeners
  useEffect(() => {
    let isCancelled = false;
    const unlisteners: UnlistenFn[] = [];

    async function registerListeners() {
      try {
        const unlistenUpdate = await listen<PanelUpdatePayload>('panel:update', (event) => {
          const payload = event.payload;
          if (!payload || payload.id !== panelId) return;
          // Ignore self-echoes from this overlay window
          if (payload._source === `overlay_${panelId}`) {
            return;
          }
          panelRef.current = payload;
          setPanel(payload);
        });
        if (isCancelled) unlistenUpdate();
        else unlisteners.push(unlistenUpdate);

        const unlistenPause = await listen('panel:toggle-global-pause', () => {
          setGlobalPaused((prev) => !prev);
        });
        if (isCancelled) unlistenPause();
        else unlisteners.push(unlistenPause);

        const unlistenSyncRect = await listen<{
          id: string;
          position?: { x: number; y: number };
          size?: { width: number; height: number };
        }>('panel:sync-rect', (event) => {
          if (event.payload && event.payload.id === panelId) {
            setPanel((prev) => {
              if (!prev) return prev;
              const next = {
                ...prev,
                position: event.payload.position ?? prev.position,
                size: event.payload.size ?? prev.size,
              };
              panelRef.current = next;
              return next;
            });
          }
        });
        if (isCancelled) unlistenSyncRect();
        else unlisteners.push(unlistenSyncRect);
      } catch {
        // Outside Tauri
      }
    }

    void registerListeners();

    return () => {
      isCancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [panelId]);

  const handleUpdate = useCallback(
    (updated: PanelConfig) => {
      // Check if changes actually occurred to avoid re-triggering updates
      const currentSerialized = panelRef.current ? JSON.stringify(panelRef.current) : '';
      const updatedSerialized = JSON.stringify(updated);
      if (currentSerialized === updatedSerialized) {
        return;
      }

      panelRef.current = updated;
      setPanel(updated);

      const payload: PanelUpdatePayload = {
        ...updated,
        _source: `overlay_${panelId}`,
      };
      emit('panel:update', payload).catch(() => {});
    },
    [panelId]
  );

  if (isLoading) {
    return <div data-testid="overlay-loading" className="w-screen h-screen bg-transparent" />;
  }

  if (!panel) {
    return (
      <div
        data-testid="overlay-unmatched"
        className="w-screen h-screen bg-transparent flex items-center justify-center text-xs text-slate-500"
      >
        面板不存在或已关闭
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent m-0 p-0 select-none">
      <OverlayView
        panel={panel}
        globalPaused={globalPaused}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

function MainContainer() {
  const [state, dispatch] = useReducer(panelReducer, DEFAULT_APP_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [isLoaded, setIsLoaded] = useState(false);
  const isFirstMountAfterLoad = useRef(true);

  // Initial load and auto-restore of visible overlay windows
  useEffect(() => {
    let isCancelled = false;
    async function loadData() {
      try {
        const loaded: AppState = await invoke('load_panels');
        if (isCancelled) return;
        if (loaded && Array.isArray(loaded.panels)) {
          dispatch({ type: 'SET_STATE', payload: loaded });
          // Auto-restore overlay windows for visible panels
          for (const panel of loaded.panels) {
            if (panel.visible) {
              invoke('open_or_focus_overlay', {
                id: panel.id,
                x: panel.position.x,
                y: panel.position.y,
                width: panel.size.width,
                height: panel.size.height,
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Outside Tauri or load error
      } finally {
        if (!isCancelled) {
          setIsLoaded(true);
        }
      }
    }
    void loadData();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Debounced auto-persistence (300ms) on state modification
  useEffect(() => {
    if (!isLoaded) return;
    if (isFirstMountAfterLoad.current) {
      isFirstMountAfterLoad.current = false;
      return;
    }
    const timer = setTimeout(() => {
      invoke('save_panels', { state }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [state, isLoaded]);

  // IPC Event Listeners in Main Window
  useEffect(() => {
    let isCancelled = false;
    const unlisteners: UnlistenFn[] = [];

    async function registerListeners() {
      try {
        // Overlay modified panel (quick edit, font size, resize)
        const unlistenUpdate = await listen<PanelUpdatePayload>('panel:update', (event) => {
          const payload = event.payload;
          if (!payload || !payload.id) return;
          // Ignore self-echoes from main window
          if (payload._source === 'main') {
            return;
          }
          dispatch({
            type: 'UPDATE_PANEL',
            payload: { id: payload.id, changes: payload },
          });
        });
        if (isCancelled) unlistenUpdate();
        else unlisteners.push(unlistenUpdate);

        // Overlay moved or resized
        const unlistenSyncRect = await listen<{
          id: string;
          position?: { x: number; y: number };
          size?: { width: number; height: number };
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>('panel:sync-rect', (event) => {
          const payload = event.payload;
          if (!payload || !payload.id) return;
          const changes: Partial<PanelConfig> = {};
          if (payload.position) changes.position = payload.position;
          else if (payload.x !== undefined && payload.y !== undefined) {
            changes.position = { x: payload.x, y: payload.y };
          }
          if (payload.size) changes.size = payload.size;
          else if (payload.width !== undefined && payload.height !== undefined) {
            changes.size = { width: payload.width, height: payload.height };
          }
          dispatch({
            type: 'UPDATE_PANEL',
            payload: { id: payload.id, changes },
          });
        });
        if (isCancelled) unlistenSyncRect();
        else unlisteners.push(unlistenSyncRect);

        // Global hotkey or system tray toggle
        const unlistenPause = await listen<{ source?: string }>(
          'panel:toggle-global-pause',
          (event) => {
            // Ignore self-echo when triggered by main user button click
            if (event.payload?.source !== 'main_user') {
              dispatch({ type: 'TOGGLE_GLOBAL_PAUSE' });
            }
          }
        );
        if (isCancelled) unlistenPause();
        else unlisteners.push(unlistenPause);

        // System tray toggle all visibility
        const unlistenToggleAllVisibility = await listen(
          'panel:toggle-all-visibility',
          () => {
            const currentState = stateRef.current;
            const anyVisible = currentState.panels.some((p) => p.visible);
            const nextVisible = !anyVisible;

            dispatch({ type: 'TOGGLE_ALL_VISIBILITY' });

            for (const panel of currentState.panels) {
              if (nextVisible) {
                invoke('open_or_focus_overlay', {
                  id: panel.id,
                  x: panel.position.x,
                  y: panel.position.y,
                  width: panel.size.width,
                  height: panel.size.height,
                }).catch(() => {});
              } else {
                invoke('close_overlay', { id: panel.id }).catch(() => {});
              }
            }
          }
        );
        if (isCancelled) unlistenToggleAllVisibility();
        else unlisteners.push(unlistenToggleAllVisibility);
      } catch {
        // Outside Tauri
      }
    }

    void registerListeners();

    return () => {
      isCancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  const handleAdd = () => {
    const newPanel = createDefaultPanel();
    dispatch({ type: 'ADD_PANEL', payload: newPanel });
    if (newPanel.visible) {
      invoke('open_or_focus_overlay', {
        id: newPanel.id,
        x: newPanel.position.x,
        y: newPanel.position.y,
        width: newPanel.size.width,
        height: newPanel.size.height,
      }).catch(() => {});
    }
  };

  const handleUpdate = (updated: PanelConfig) => {
    dispatch({
      type: 'UPDATE_PANEL',
      payload: { id: updated.id, changes: updated },
    });
    const payload: PanelUpdatePayload = {
      ...updated,
      _source: 'main',
    };
    emit('panel:update', payload).catch(() => {});

    if (updated.visible) {
      invoke('open_or_focus_overlay', {
        id: updated.id,
        x: updated.position.x,
        y: updated.position.y,
        width: updated.size.width,
        height: updated.size.height,
      }).catch(() => {});
    }
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'REMOVE_PANEL', payload: { id } });
    invoke('close_overlay', { id }).catch(() => {});
  };

  const handleToggleVisible = (id: string) => {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel) return;
    const nextVisible = !panel.visible;
    dispatch({ type: 'TOGGLE_VISIBLE', payload: { id } });
    if (nextVisible) {
      invoke('open_or_focus_overlay', {
        id: panel.id,
        x: panel.position.x,
        y: panel.position.y,
        width: panel.size.width,
        height: panel.size.height,
      }).catch(() => {});
    } else {
      invoke('close_overlay', { id: panel.id }).catch(() => {});
    }
  };

  const handleTogglePause = (id: string) => {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel) return;
    const updated = {
      ...panel,
      scroll: {
        ...panel.scroll,
        paused: !panel.scroll.paused,
      },
    };
    dispatch({ type: 'TOGGLE_PAUSE', payload: { id } });
    const payload: PanelUpdatePayload = {
      ...updated,
      _source: 'main',
    };
    emit('panel:update', payload).catch(() => {});
  };

  const handleToggleGlobalPause = () => {
    dispatch({ type: 'TOGGLE_GLOBAL_PAUSE' });
    emit('panel:toggle-global-pause', { source: 'main_user' }).catch(() => {});
  };

  return (
    <MainDashboard
      state={state}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onToggleVisible={handleToggleVisible}
      onTogglePause={handleTogglePause}
      onToggleGlobalPause={handleToggleGlobalPause}
    />
  );
}

export interface AppProps {
  initialHash?: string;
}

export default function App({ initialHash }: AppProps = {}) {
  const route = useHashRoute(initialHash);

  if (route.type === 'overlay') {
    return <OverlayContainer panelId={route.panelId} />;
  }

  return <MainContainer />;
}
