import { describe, it, expect } from 'vitest';
import {
  panelReducer,
  createDefaultPanel,
  DEFAULT_APP_STATE,
  AppState,
  addPanel,
  updatePanel,
  removePanel,
  toggleVisible,
  togglePause,
  setGlobalPause,
  toggleGlobalPause,
  setState,
} from './panelStore';

describe('panelStore', () => {
  describe('createDefaultPanel', () => {
    it('creates default panel with standard properties', () => {
      const p = createDefaultPanel('Test Panel');
      expect(p.name).toBe('Test Panel');
      expect(p.id).toBeDefined();
      expect(typeof p.id).toBe('string');
      expect(p.text).toBeDefined();
      expect(p.position).toEqual({ x: 100, y: 100 });
      expect(p.size).toEqual({ width: 400, height: 120 });
      expect(p.style.fontSize).toBe(24);
      expect(p.style.fontColor).toBe('#ffffff');
      expect(p.style.fontWeight).toBe('normal');
      expect(p.style.fontStyle).toBe('normal');
      expect(p.style.bgColor).toBe('#000000');
      expect(p.style.bgOpacity).toBe(0.5);
      expect(p.style.textAlign).toBe('left');
      expect(p.style.textShadow).toBe(false);
      expect(p.scroll.mode).toBe('horizontal');
      expect(p.scroll.speed).toBe(50);
      expect(p.scroll.loop).toBe(true);
      expect(p.scroll.paused).toBe(false);
      expect(p.visible).toBe(true);
    });

    it('creates unique IDs for consecutive calls', () => {
      const p1 = createDefaultPanel();
      const p2 = createDefaultPanel();
      expect(p1.id).not.toBe(p2.id);
    });

    it('falls back to default name when no name is provided', () => {
      const p = createDefaultPanel();
      expect(p.name).toBe('新建面板');
    });
  });

  describe('DEFAULT_APP_STATE', () => {
    it('has standard initial values', () => {
      expect(DEFAULT_APP_STATE).toEqual({
        panels: [],
        globalPaused: false,
        hotkey: 'Ctrl+Alt+Space',
      });
    });
  });

  describe('panelReducer', () => {
    const initialState: AppState = {
      panels: [],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    };

    it('adds a panel to app state (ADD_PANEL)', () => {
      const newPanel = createDefaultPanel('P1');
      const state = panelReducer(initialState, { type: 'ADD_PANEL', payload: newPanel });
      expect(state.panels).toHaveLength(1);
      expect(state.panels[0].id).toBe(newPanel.id);
      expect(state.panels[0].name).toBe('P1');
      // Ensure immutability
      expect(state).not.toBe(initialState);
      expect(initialState.panels).toHaveLength(0);
    });

    it('updates panel properties (UPDATE_PANEL)', () => {
      const p = createDefaultPanel('P1');
      const stateWithPanel: AppState = { ...initialState, panels: [p] };
      const state = panelReducer(stateWithPanel, {
        type: 'UPDATE_PANEL',
        payload: { id: p.id, changes: { text: 'Updated Text', style: { ...p.style, fontSize: 32 } } },
      });
      expect(state.panels[0].text).toBe('Updated Text');
      expect(state.panels[0].style.fontSize).toBe(32);
      expect(state.panels[0].name).toBe('P1');
      expect(stateWithPanel.panels[0].text).not.toBe('Updated Text');
    });

    it('does not mutate state when UPDATE_PANEL targets non-existent panel', () => {
      const p = createDefaultPanel('P1');
      const stateWithPanel: AppState = { ...initialState, panels: [p] };
      const state = panelReducer(stateWithPanel, {
        type: 'UPDATE_PANEL',
        payload: { id: 'non-existent', changes: { text: 'Updated' } },
      });
      expect(state.panels[0].text).toBe(p.text);
    });

    it('removes a panel from app state (REMOVE_PANEL)', () => {
      const p1 = createDefaultPanel('P1');
      const p2 = createDefaultPanel('P2');
      const stateWithPanels: AppState = { ...initialState, panels: [p1, p2] };
      const state = panelReducer(stateWithPanels, {
        type: 'REMOVE_PANEL',
        payload: { id: p1.id },
      });
      expect(state.panels).toHaveLength(1);
      expect(state.panels[0].id).toBe(p2.id);
    });

    it('toggles panel visibility (TOGGLE_VISIBLE)', () => {
      const p = createDefaultPanel('P1');
      expect(p.visible).toBe(true);
      const stateWithPanel: AppState = { ...initialState, panels: [p] };

      const s1 = panelReducer(stateWithPanel, {
        type: 'TOGGLE_VISIBLE',
        payload: { id: p.id },
      });
      expect(s1.panels[0].visible).toBe(false);

      const s2 = panelReducer(s1, {
        type: 'TOGGLE_VISIBLE',
        payload: { id: p.id },
      });
      expect(s2.panels[0].visible).toBe(true);
    });

    it('toggles panel pause (TOGGLE_PAUSE)', () => {
      const p = createDefaultPanel('P1');
      expect(p.scroll.paused).toBe(false);
      const stateWithPanel: AppState = { ...initialState, panels: [p] };

      const s1 = panelReducer(stateWithPanel, {
        type: 'TOGGLE_PAUSE',
        payload: { id: p.id },
      });
      expect(s1.panels[0].scroll.paused).toBe(true);

      const s2 = panelReducer(s1, {
        type: 'TOGGLE_PAUSE',
        payload: { id: p.id },
      });
      expect(s2.panels[0].scroll.paused).toBe(false);
    });

    it('sets global pause directly (SET_GLOBAL_PAUSE)', () => {
      const s1 = panelReducer(initialState, {
        type: 'SET_GLOBAL_PAUSE',
        payload: true,
      });
      expect(s1.globalPaused).toBe(true);

      const s2 = panelReducer(s1, {
        type: 'SET_GLOBAL_PAUSE',
        payload: false,
      });
      expect(s2.globalPaused).toBe(false);
    });

    it('toggles global pause (TOGGLE_GLOBAL_PAUSE)', () => {
      const s1 = panelReducer(initialState, { type: 'TOGGLE_GLOBAL_PAUSE' });
      expect(s1.globalPaused).toBe(true);
      const s2 = panelReducer(s1, { type: 'TOGGLE_GLOBAL_PAUSE' });
      expect(s2.globalPaused).toBe(false);
    });

    it('replaces entire state (SET_STATE)', () => {
      const p = createDefaultPanel('Imported');
      const newState: AppState = {
        panels: [p],
        globalPaused: true,
        hotkey: 'Ctrl+Shift+P',
      };
      const state = panelReducer(initialState, {
        type: 'SET_STATE',
        payload: newState,
      });
      expect(state).toEqual(newState);
    });

    it('returns current state on unknown action', () => {
      // @ts-expect-error test unknown action type
      const state = panelReducer(initialState, { type: 'UNKNOWN_ACTION' });
      expect(state).toBe(initialState);
    });
  });

  describe('action creators', () => {
    it('creates correct action objects', () => {
      const p = createDefaultPanel('P');
      expect(addPanel(p)).toEqual({ type: 'ADD_PANEL', payload: p });
      expect(updatePanel('123', { name: 'New' })).toEqual({
        type: 'UPDATE_PANEL',
        payload: { id: '123', changes: { name: 'New' } },
      });
      expect(removePanel('123')).toEqual({
        type: 'REMOVE_PANEL',
        payload: { id: '123' },
      });
      expect(toggleVisible('123')).toEqual({
        type: 'TOGGLE_VISIBLE',
        payload: { id: '123' },
      });
      expect(togglePause('123')).toEqual({
        type: 'TOGGLE_PAUSE',
        payload: { id: '123' },
      });
      expect(setGlobalPause(true)).toEqual({
        type: 'SET_GLOBAL_PAUSE',
        payload: true,
      });
      expect(toggleGlobalPause()).toEqual({
        type: 'TOGGLE_GLOBAL_PAUSE',
      });
      const dummyState: AppState = { panels: [], globalPaused: true, hotkey: 'Alt+A' };
      expect(setState(dummyState)).toEqual({
        type: 'SET_STATE',
        payload: dummyState,
      });
    });
  });
});
