import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { createDefaultPanel } from './store/panelStore';

// Mock Tauri core & event
const mockInvoke = vi.fn();
const mockEmit = vi.fn();
const mockListeners = new Map<string, Array<(event: any) => void>>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: any[]) => mockEmit(...args),
  listen: vi.fn((eventName: string, handler: any) => {
    const current = mockListeners.get(eventName) || [];
    current.push(handler);
    mockListeners.set(eventName, current);

    return Promise.resolve(() => {
      const updated = mockListeners.get(eventName) || [];
      mockListeners.set(
        eventName,
        updated.filter((fn) => fn !== handler)
      );
    });
  }),
}));

function triggerMockTauriEvent(eventName: string, payload: any) {
  const handlers = mockListeners.get(eventName) || [];
  handlers.forEach((fn) => fn({ payload }));
}

describe('App & Router Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    window.location.hash = '';
    mockInvoke.mockResolvedValue(undefined);
    mockEmit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  it('renders MainDashboard when hash is empty or #/', async () => {
    window.location.hash = '';
    mockInvoke.mockResolvedValueOnce({
      panels: [],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    });

    render(<App />);

    expect(await screen.findByText('屏幕字幕与便签管理')).toBeInTheDocument();
    expect(screen.getByTestId('add-panel-btn')).toBeInTheDocument();
  });

  it('auto-restores saved panels and invokes open_or_focus_overlay for visible panels', async () => {
    window.location.hash = '#/';
    const testPanel = createDefaultPanel('恢复面板');
    testPanel.visible = true;
    testPanel.position = { x: 120, y: 220 };
    testPanel.size = { width: 450, height: 130 };

    const hiddenPanel = createDefaultPanel('隐藏面板');
    hiddenPanel.visible = false;

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_panels') {
        return Promise.resolve({
          panels: [testPanel, hiddenPanel],
          globalPaused: false,
          hotkey: 'Ctrl+Alt+Space',
        });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText('恢复面板')).toBeInTheDocument();
    expect(screen.getByText('隐藏面板')).toBeInTheDocument();

    // Verify open_or_focus_overlay was called for visible panel but not hidden panel
    expect(mockInvoke).toHaveBeenCalledWith('open_or_focus_overlay', {
      id: testPanel.id,
      x: 120,
      y: 220,
      width: 450,
      height: 130,
    });
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'open_or_focus_overlay',
      expect.objectContaining({
        id: hiddenPanel.id,
      })
    );
  });

  it('debounces save_panels when state is modified', async () => {
    window.location.hash = '#/';
    mockInvoke.mockResolvedValue({
      panels: [],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    });

    render(<App />);
    const addBtn = await screen.findByTestId('add-panel-btn');

    // Switch to fake timers to verify debounce behavior
    vi.useFakeTimers();

    act(() => {
      fireEvent.click(addBtn);
    });

    // Right after click, save_panels should not have been called yet due to 300ms debounce
    const saveCallsBefore = mockInvoke.mock.calls.filter((call) => call[0] === 'save_panels');
    expect(saveCallsBefore.length).toBe(0);

    // Advance 300ms timer
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const saveCallsAfter = mockInvoke.mock.calls.filter((call) => call[0] === 'save_panels');
    expect(saveCallsAfter.length).toBeGreaterThanOrEqual(1);
  });

  it('updates panel in state when incoming panel:update Tauri event is received', async () => {
    window.location.hash = '#/';
    const panel = createDefaultPanel('初始面板名称');
    panel.text = '初始内容';

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_panels') {
        return Promise.resolve({
          panels: [panel],
          globalPaused: false,
          hotkey: 'Ctrl+Alt+Space',
        });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    expect(await screen.findByText('初始面板名称')).toBeInTheDocument();

    // Trigger panel:update event from overlay
    act(() => {
      triggerMockTauriEvent('panel:update', {
        ...panel,
        name: '由悬浮窗修改后的名称',
        text: '由悬浮窗修改后的文本',
      });
    });

    expect(await screen.findByText('由悬浮窗修改后的名称')).toBeInTheDocument();
    expect(screen.getByText('由悬浮窗修改后的文本')).toBeInTheDocument();
  });

  it('toggles global pause on incoming panel:toggle-global-pause Tauri event', async () => {
    window.location.hash = '#/';
    mockInvoke.mockResolvedValue({
      panels: [],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    });

    render(<App />);
    expect(await screen.findByTestId('global-pause-btn')).toHaveTextContent(/全部暂停/);

    act(() => {
      triggerMockTauriEvent('panel:toggle-global-pause', {});
    });

    expect(screen.getByTestId('global-pause-btn')).toHaveTextContent(/全部继续|全部恢复/);
  });

  it('renders OverlayView when hash matches #/overlay/:id and panel exists', async () => {
    const panel = createDefaultPanel('悬浮窗台词');
    panel.id = 'panel-test-123';
    panel.text = '正在滚动的提示词内容';

    window.location.hash = `#/overlay/${panel.id}`;

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_panels') {
        return Promise.resolve({
          panels: [panel],
          globalPaused: false,
          hotkey: 'Ctrl+Alt+Space',
        });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText('正在滚动的提示词内容')).toBeInTheDocument();
    expect(screen.queryByTestId('add-panel-btn')).not.toBeInTheDocument();
  });

  it('renders clean unmatched state when hash matches #/overlay/:id but panel is not found', async () => {
    window.location.hash = '#/overlay/unknown-id';

    mockInvoke.mockResolvedValue({
      panels: [],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    });

    render(<App />);

    const unmatched = await screen.findByTestId('overlay-unmatched');
    expect(unmatched).toBeInTheDocument();
    expect(screen.queryByTestId('scroll-viewport')).not.toBeInTheDocument();
  });

  it('emits panel:update when OverlayView updates panel', async () => {
    const panel = createDefaultPanel('快速编辑测试');
    panel.id = 'panel-overlay-edit';
    panel.text = '原始内容';

    window.location.hash = `#/overlay/${panel.id}`;

    mockInvoke.mockResolvedValue({
      panels: [panel],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    });

    render(<App />);

    const textEl = await screen.findByText('原始内容');
    expect(textEl).toBeInTheDocument();

    // Trigger hover controls
    act(() => {
      triggerMockTauriEvent('overlay:hover-state', { id: panel.id, isHovered: true });
    });

    const plusBtn = await screen.findByTestId('font-size-plus');
    act(() => {
      fireEvent.click(plusBtn);
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'panel:update',
      expect.objectContaining({
        id: panel.id,
        style: expect.objectContaining({
          fontSize: panel.style.fontSize + 2,
        }),
      })
    );
  });

  it('switches views dynamically on window hashchange', async () => {
    window.location.hash = '#/';
    const panel = createDefaultPanel('动态切换面板');
    panel.id = 'panel-dynamic';
    panel.text = '动态切换测试文本';

    mockInvoke.mockResolvedValue({
      panels: [panel],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    });

    render(<App />);

    expect(await screen.findByText('屏幕字幕与便签管理')).toBeInTheDocument();

    // Switch hash to overlay
    act(() => {
      window.location.hash = `#/overlay/${panel.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(await screen.findByText('动态切换测试文本')).toBeInTheDocument();
    expect(screen.queryByText('屏幕字幕与便签管理')).not.toBeInTheDocument();

    // Switch hash back to main dashboard
    act(() => {
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(await screen.findByText('屏幕字幕与便签管理')).toBeInTheDocument();
  });
});
