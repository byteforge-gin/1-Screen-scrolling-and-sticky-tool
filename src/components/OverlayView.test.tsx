import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverlayView, hexToRgba } from './OverlayView';
import { createDefaultPanel } from '../store/panelStore';
import { PanelConfig } from '../types/panel';

let eventHandler: ((event: { payload: { id: string; isHovered: boolean } }) => void) | null = null;
const mockListeners = new Map<string, Array<(event: any) => void>>();
const mockStartDragging = vi.fn();

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    startDragging: () => mockStartDragging(),
    setSize: vi.fn(),
    setPosition: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, handler: any) => {
    if (eventName === 'overlay:hover-state') {
      eventHandler = handler;
    }
    const current = mockListeners.get(eventName) || [];
    current.push(handler);
    mockListeners.set(eventName, current);

    return Promise.resolve(() => {
      if (eventName === 'overlay:hover-state') {
        eventHandler = null;
      }
      const updated = mockListeners.get(eventName) || [];
      mockListeners.set(
        eventName,
        updated.filter((fn) => fn !== handler)
      );
    });
  }),
}));

describe('OverlayView', () => {
  it('renders panel text with custom styling', () => {
    const panel = createDefaultPanel('Test');
    panel.text = 'Teleprompter Line 1';
    panel.style.fontSize = 32;
    panel.style.fontColor = '#ff0000';
    panel.style.fontWeight = 'bold';
    panel.style.fontStyle = 'italic';
    panel.style.textAlign = 'center';
    panel.style.textShadow = true;

    render(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    const textEl = screen.getByText('Teleprompter Line 1');
    expect(textEl).toBeInTheDocument();
    expect(textEl.style.fontSize).toBe('32px');
    expect(textEl.style.color).toBe('rgb(255, 0, 0)');
    expect(textEl.style.fontWeight).toBe('bold');
    expect(textEl.style.fontStyle).toBe('italic');
    expect(textEl.style.textAlign).toBe('center');
    expect(textEl.style.textShadow).not.toBe('none');
  });

  it('applies background color and opacity as rgba', () => {
    const panel = createDefaultPanel('Test');
    panel.style.bgColor = '#000000';
    panel.style.bgOpacity = 0.5;

    const { container } = render(
      <OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />
    );
    const overlayRoot = container.firstChild as HTMLElement;
    expect(overlayRoot.style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('correctly converts hex and opacity to rgba with hexToRgba helper', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    expect(hexToRgba('#f00', 0.8)).toBe('rgba(255, 0, 0, 0.8)');
  });

  it('shows controls and resize handles when isHovered is true', () => {
    const panel = createDefaultPanel('Test');
    render(<OverlayView panel={panel} isHovered={true} onUpdate={() => {}} />);
    expect(screen.getByTestId('overlay-controls')).toBeInTheDocument();
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
    expect(screen.getByTestId('resize-handle-se')).toBeInTheDocument();
  });

  it('hides controls when isHovered is false', () => {
    const panel = createDefaultPanel('Test');
    render(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    expect(screen.queryByTestId('overlay-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resize-handle-se')).not.toBeInTheDocument();
  });

  it('toggles pause when play/pause button is clicked', () => {
    const panel = createDefaultPanel('Test');
    panel.scroll.paused = false;
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);
    const toggleBtn = screen.getByTestId('toggle-pause-btn');
    fireEvent.click(toggleBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        scroll: expect.objectContaining({
          paused: true,
        }),
      })
    );
  });

  it('adjusts font size with + and - buttons', () => {
    const panel = createDefaultPanel('Test');
    panel.style.fontSize = 24;
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);
    const plusBtn = screen.getByTestId('font-size-plus');
    fireEvent.click(plusBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          fontSize: 26,
        }),
      })
    );

    const minusBtn = screen.getByTestId('font-size-minus');
    fireEvent.click(minusBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          fontSize: 22,
        }),
      })
    );
  });

  it('toggles QuickEditPopover when pencil icon is clicked and applies edits', () => {
    const panel = createDefaultPanel('Test');
    panel.text = 'Original text';
    let currentPanel: PanelConfig = { ...panel };
    const onUpdate = vi.fn((updated: PanelConfig) => {
      currentPanel = updated;
    });

    const { rerender } = render(
      <OverlayView panel={currentPanel} isHovered={true} onUpdate={onUpdate} />
    );

    // Popover is initially closed
    expect(screen.queryByTestId('quick-edit-popover')).not.toBeInTheDocument();

    // Click edit icon to open
    const editBtn = screen.getByTestId('quick-edit-btn');
    fireEvent.click(editBtn);

    expect(screen.getByTestId('quick-edit-popover')).toBeInTheDocument();

    // Edit text
    const textInput = screen.getByTestId('edit-text-input');
    fireEvent.change(textInput, { target: { value: 'Updated prompt' } });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Updated prompt',
        style: expect.any(Object),
        scroll: expect.any(Object),
      })
    );

    // Edit scroll mode
    rerender(<OverlayView panel={currentPanel} isHovered={true} onUpdate={onUpdate} />);
    const modeSelect = screen.getByTestId('edit-scroll-mode-select');
    fireEvent.change(modeSelect, { target: { value: 'vertical' } });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        scroll: expect.objectContaining({
          mode: 'vertical',
        }),
      })
    );

    // Close popover
    const closeBtn = screen.getByTestId('close-popover-btn');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('quick-edit-popover')).not.toBeInTheDocument();
  });

  it('updates all styles and scroll properties from QuickEditPopover', () => {
    const panel = createDefaultPanel('Test');
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId('quick-edit-btn'));

    // Font size input
    fireEvent.change(screen.getByTestId('edit-font-size-input'), { target: { value: '48' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ fontSize: 48 }),
      })
    );

    // Font color input
    fireEvent.change(screen.getByTestId('edit-font-color-input'), { target: { value: '#00ff00' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ fontColor: '#00ff00' }),
      })
    );

    // Background color input
    fireEvent.change(screen.getByTestId('edit-bg-color-input'), { target: { value: '#123456' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ bgColor: '#123456' }),
      })
    );

    // Background opacity input
    fireEvent.change(screen.getByTestId('edit-bg-opacity-input'), { target: { value: '0.8' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ bgOpacity: 0.8 }),
      })
    );

    // Scroll speed input
    fireEvent.change(screen.getByTestId('edit-scroll-speed-input'), { target: { value: '120' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        scroll: expect.objectContaining({ speed: 120 }),
      })
    );

    // Loop checkbox
    fireEvent.click(screen.getByTestId('edit-loop-checkbox'));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        scroll: expect.objectContaining({ loop: false }),
      })
    );
  });

  it('handles mouseEnter and mouseLeave when isHovered prop is omitted', () => {
    const panel = createDefaultPanel('Test');
    const { container } = render(<OverlayView panel={panel} onUpdate={() => {}} />);
    const rootEl = container.firstChild as HTMLElement;

    expect(screen.queryByTestId('overlay-controls')).not.toBeInTheDocument();

    fireEvent.mouseEnter(rootEl);
    expect(screen.getByTestId('overlay-controls')).toBeInTheDocument();

    fireEvent.mouseLeave(rootEl);
    expect(screen.queryByTestId('overlay-controls')).not.toBeInTheDocument();
  });

  it('resizes overlay dimensions and positions when dragging top-left (nw) handle', () => {
    const panel = createDefaultPanel('Test');
    panel.size = { width: 400, height: 120 };
    panel.position = { x: 100, y: 100 };
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);
    const handleNw = screen.getByTestId('resize-handle-nw');

    // Drag nw 20px right and 30px down (shrinking size, increasing x and y)
    fireEvent.mouseDown(handleNw, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 120, clientY: 130 });
    fireEvent.mouseUp(window);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 120, y: 130 },
        size: { width: 380, height: 90 },
      })
    );
  });

  it('clamps to minimum dimensions when dragging resize handles inward beyond limit', () => {
    const panel = createDefaultPanel('Test');
    panel.size = { width: 120, height: 50 };
    panel.position = { x: 100, y: 100 };
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);
    const handleSe = screen.getByTestId('resize-handle-se');

    // Drag se 100px left and 100px up (attempt to shrink below minWidth 100, minHeight 40)
    fireEvent.mouseDown(handleSe, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(window);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        size: { width: 100, height: 40 },
      })
    );
  });

  it('updates hover state when receiving Tauri overlay:hover-state event', async () => {
    const panel = createDefaultPanel('Test');
    render(<OverlayView panel={panel} onUpdate={() => {}} />);

    // Wait for listen promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Initially not hovered
    expect(screen.queryByTestId('overlay-controls')).not.toBeInTheDocument();

    // Trigger Tauri event for this panel
    await act(async () => {
      expect(eventHandler).not.toBeNull();
      if (eventHandler) {
        eventHandler({ payload: { id: panel.id, isHovered: true } });
      }
    });

    expect(screen.getByTestId('overlay-controls')).toBeInTheDocument();

    // Trigger hover-state false
    await act(async () => {
      if (eventHandler) {
        eventHandler({ payload: { id: panel.id, isHovered: false } });
      }
    });

    expect(screen.queryByTestId('overlay-controls')).not.toBeInTheDocument();
  });

  it('renders horizontal scroll transform in horizontal mode', () => {
    const panel = createDefaultPanel('Test');
    panel.scroll.mode = 'horizontal';
    render(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    const scrollContainer = screen.getByTestId('scroll-content');
    expect(scrollContainer.style.transform).toContain('translateX');
    expect(scrollContainer.style.whiteSpace).toBe('nowrap');
  });

  it('renders vertical scroll transform in vertical mode', () => {
    const panel = createDefaultPanel('Test');
    panel.scroll.mode = 'vertical';
    render(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    const scrollContainer = screen.getByTestId('scroll-content');
    expect(scrollContainer.style.transform).toContain('translateY');
  });

  it('renders static display in none mode', () => {
    const panel = createDefaultPanel('Test');
    panel.scroll.mode = 'none';
    render(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    const scrollContainer = screen.getByTestId('scroll-content');
    expect(scrollContainer.style.transform).toBe('none');
  });

  it('resizes overlay dimensions when dragging edge handles (e, s, w, n)', () => {
    const panel = createDefaultPanel('Test');
    panel.size = { width: 400, height: 120 };
    panel.position = { x: 100, y: 100 };
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);

    // Test 'e' handle
    const handleE = screen.getByTestId('resize-handle-e');
    fireEvent.mouseDown(handleE, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 230, clientY: 200 });
    fireEvent.mouseUp(window);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        size: { width: 430, height: 120 },
      })
    );

    // Test 's' handle
    const handleS = screen.getByTestId('resize-handle-s');
    fireEvent.mouseDown(handleS, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 200, clientY: 240 });
    fireEvent.mouseUp(window);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        size: { width: 400, height: 160 },
      })
    );

    // Test 'w' handle
    const handleW = screen.getByTestId('resize-handle-w');
    fireEvent.mouseDown(handleW, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 100 });
    fireEvent.mouseUp(window);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 80, y: 100 },
        size: { width: 420, height: 120 },
      })
    );

    // Test 'n' handle
    const handleN = screen.getByTestId('resize-handle-n');
    fireEvent.mouseDown(handleN, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 100, clientY: 80 });
    fireEvent.mouseUp(window);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 100, y: 80 },
        size: { width: 400, height: 140 },
      })
    );
  });

  it('honors globalPaused prop by showing paused state', () => {
    const panel = createDefaultPanel('Test');
    panel.scroll.paused = false;
    render(
      <OverlayView panel={panel} isHovered={true} onUpdate={() => {}} globalPaused={true} />
    );
    const toggleBtn = screen.getByTestId('toggle-pause-btn');
    expect(toggleBtn).toHaveAttribute('aria-label', '播放');
  });

  it('anchors layout properly: horizontal starts at left, vertical starts at top, none has full width', () => {
    // 1. Horizontal mode
    const panelH = createDefaultPanel('H');
    panelH.scroll.mode = 'horizontal';
    const { rerender } = render(<OverlayView panel={panelH} isHovered={false} onUpdate={() => {}} />);
    const viewportH = screen.getByTestId('scroll-viewport');
    expect(viewportH.className).toContain('justify-start');
    expect(viewportH.className).toContain('items-center');
    expect(viewportH.className).toContain('overflow-hidden');

    // Root overlay should NOT have overflow-hidden (controls and popover must be visible)
    const overlayRoot = viewportH.parentElement as HTMLElement;
    expect(overlayRoot.className).not.toContain('overflow-hidden');

    // 2. Vertical mode
    const panelV = createDefaultPanel('V');
    panelV.scroll.mode = 'vertical';
    rerender(<OverlayView panel={panelV} isHovered={false} onUpdate={() => {}} />);
    const viewportV = screen.getByTestId('scroll-viewport');
    expect(viewportV.className).toContain('items-start');
    expect(viewportV.className).toContain('justify-start');
    const contentV = screen.getByTestId('scroll-content');
    expect(contentV.style.width).toBe('100%');

    // 3. None mode with right align
    const panelNone = createDefaultPanel('None');
    panelNone.scroll.mode = 'none';
    panelNone.style.textAlign = 'right';
    rerender(<OverlayView panel={panelNone} isHovered={false} onUpdate={() => {}} />);
    const contentNone = screen.getByTestId('scroll-content');
    expect(contentNone.style.textAlign).toBe('right');
    expect(contentNone.style.width).toBe('100%');
  });

  it('updates rendered content dynamically when panel prop changes', () => {
    const panel = createDefaultPanel('Test');
    panel.text = '原始内容';
    const { rerender } = render(<OverlayView panel={panel} onUpdate={vi.fn()} />);
    expect(screen.getByText('原始内容')).toBeInTheDocument();

    const updatedPanel: PanelConfig = {
      ...panel,
      text: '通过属性同步更新后的内容',
      style: {
        ...panel.style,
        fontSize: 36,
      },
    };

    rerender(<OverlayView panel={updatedPanel} onUpdate={vi.fn()} />);
    expect(screen.getByText('通过属性同步更新后的内容')).toBeInTheDocument();
  });

  it('popover is scrollable for small windows and form inputs have select-text', () => {
    const panel = createDefaultPanel('Test');
    render(<OverlayView panel={panel} isHovered={true} onUpdate={() => {}} />);

    // Open popover
    fireEvent.click(screen.getByTestId('quick-edit-btn'));

    const popover = screen.getByTestId('quick-edit-popover');
    expect(popover.className).toContain('overflow-y-auto');
    expect(popover.className).toContain('max-h-');

    const textInput = screen.getByTestId('edit-text-input');
    expect(textInput.className).toContain('select-text');

    const fontSizeInput = screen.getByTestId('edit-font-size-input');
    expect(fontSizeInput.className).toContain('select-text');
  });

  it('uses screenX and screenY during resize to prevent jitter when window origin moves', () => {
    const panel = createDefaultPanel('Test');
    panel.size = { width: 400, height: 120 };
    panel.position = { x: 100, y: 100 };
    const onUpdate = vi.fn();

    render(<OverlayView panel={panel} isHovered={true} onUpdate={onUpdate} />);
    const handleW = screen.getByTestId('resize-handle-w');

    // Simulate mouse drag with screenX / screenY (e.g. dragging left 30px on screen)
    // clientX in an actual moving window would shift, but screenX remains absolute
    fireEvent.mouseDown(handleW, {
      clientX: 5,
      clientY: 60,
      screenX: 105,
      screenY: 160,
    });
    fireEvent.mouseMove(window, {
      clientX: 5, // clientX might not change if window followed mouse
      clientY: 60,
      screenX: 75, // screenX moved 30px left
      screenY: 160,
    });
    fireEvent.mouseUp(window);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 70, y: 100 },
        size: { width: 430, height: 120 },
      })
    );
  });

  it('triggers startDragging on background mousedown when hovered, but not on text or controls', () => {
    mockStartDragging.mockClear();
    const panel = createDefaultPanel('拖拽测试');
    const { rerender } = render(
      <OverlayView panel={panel} isHovered={true} onUpdate={() => {}} />
    );

    const container = screen.getByTestId('overlay-container');
    const textContent = screen.getByTestId('scroll-content');
    const pauseBtn = screen.getByTestId('toggle-pause-btn');

    // 1. Mousedown on text -> should NOT start dragging
    fireEvent.mouseDown(textContent, { button: 0 });
    expect(mockStartDragging).not.toHaveBeenCalled();

    // 2. Mousedown on controls button -> should NOT start dragging from container
    fireEvent.mouseDown(pauseBtn, { button: 0 });
    expect(mockStartDragging).not.toHaveBeenCalled();

    // 3. Mousedown on background container -> SHOULD start dragging
    fireEvent.mouseDown(container, { button: 0 });
    expect(mockStartDragging).toHaveBeenCalledTimes(1);

    // 4. Mousedown on background container with right-click (button 2) -> should NOT start dragging
    mockStartDragging.mockClear();
    fireEvent.mouseDown(container, { button: 2 });
    expect(mockStartDragging).not.toHaveBeenCalled();

    // 5. When not hovered -> background mousedown should NOT start dragging
    rerender(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    mockStartDragging.mockClear();
    fireEvent.mouseDown(container, { button: 0 });
    expect(mockStartDragging).not.toHaveBeenCalled();
  });
});
