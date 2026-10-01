import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollEngine } from './useScrollEngine';
import { PanelScroll } from '../types/panel';

describe('useScrollEngine', () => {
  let mockRafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;
  let currentTime: number;

  beforeEach(() => {
    mockRafCallbacks = new Map();
    nextRafId = 1;
    currentTime = 1000;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      mockRafCallbacks.set(id, cb);
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      mockRafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stepFrame = (deltaMs: number) => {
    currentTime += deltaMs;
    // Snapshot current callbacks to avoid infinite loop within one frame
    const currentCallbacks = Array.from(mockRafCallbacks.entries());
    mockRafCallbacks.clear();
    for (const [, cb] of currentCallbacks) {
      cb(currentTime);
    }
  };

  it('initializes offset to 0 when mode is none', () => {
    const scroll: PanelScroll = {
      mode: 'none',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false)
    );

    expect(result.current.offset).toBe(0);
    expect(result.current.isPaused).toBe(false);
  });

  it('initializes offset to containerSize for horizontal/vertical scrolling by default', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false)
    );

    expect(result.current.offset).toBe(400);
  });

  it('allows custom initialOffset when provided', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false, 50)
    );

    expect(result.current.offset).toBe(50);
  });

  it('updates offset on each animation frame according to speed and delta', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100, // 100px/s => 1px per 10ms
      loop: true,
      paused: false,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false, 100)
    );

    expect(result.current.offset).toBe(100);

    // Initial frame establishes lastTime baseline
    act(() => {
      stepFrame(16);
    });

    // Second frame: 50ms elapsed => displacement = (100 * 50) / 1000 = 5px
    act(() => {
      stepFrame(50);
    });

    expect(result.current.offset).toBe(95);
  });

  it('does not advance offset when paused or globalPaused is true', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: true,
    };

    const { result, rerender } = renderHook(
      ({ paused, globalPaused }) =>
        useScrollEngine({ ...scroll, paused }, 400, 200, globalPaused, 100),
      { initialProps: { paused: true, globalPaused: false } }
    );

    expect(result.current.isPaused).toBe(true);

    act(() => {
      stepFrame(16);
      stepFrame(50);
    });

    expect(result.current.offset).toBe(100);

    // Now unpause scrollConfig, but enable globalPaused
    rerender({ paused: false, globalPaused: true });
    expect(result.current.isPaused).toBe(true);

    act(() => {
      stepFrame(50);
    });

    expect(result.current.offset).toBe(100);
  });

  it('supports togglePause to locally pause and unpause scrolling', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false, 100)
    );

    // Baseline frame
    act(() => {
      stepFrame(16);
    });

    // Toggle pause ON
    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      stepFrame(50);
    });

    expect(result.current.offset).toBe(100);

    // Toggle pause OFF
    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(false);

    // Next frame: lastTime is updated, smooth continuation without jump
    act(() => {
      stepFrame(50);
    });

    expect(result.current.offset).toBe(95);
  });

  it('allows togglePause to unpause when scrollConfig.paused is initially true', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: true,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false, 100)
    );

    expect(result.current.isPaused).toBe(true);

    act(() => {
      stepFrame(16);
    });

    // Toggle pause while initially paused => should now be unpaused!
    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(false);

    act(() => {
      stepFrame(50);
    });

    // 100px/s * 50ms = 5px movement => 95
    expect(result.current.offset).toBe(95);
  });

  it('resets local pause override when scrollConfig.paused prop updates', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result, rerender } = renderHook(
      ({ s }) => useScrollEngine(s, 400, 200, false, 100),
      { initialProps: { s: scroll } }
    );

    // Override to pause
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.isPaused).toBe(true);

    // Prop updates to paused: true (overrides/clears local toggle)
    rerender({ s: { ...scroll, paused: true } });
    expect(result.current.isPaused).toBe(true);

    // Now external prop unpauses
    rerender({ s: { ...scroll, paused: false } });
    expect(result.current.isPaused).toBe(false);
  });

  it('does not schedule requestAnimationFrame when mode is none', () => {
    const scroll: PanelScroll = {
      mode: 'none',
      speed: 100,
      loop: true,
      paused: false,
    };

    renderHook(() =>
      useScrollEngine(scroll, 400, 200, false)
    );

    expect(mockRafCallbacks.size).toBe(0);
  });

  it('resets offset to containerSize when mode transitions from none to horizontal or vertical', () => {
    let scroll: PanelScroll = {
      mode: 'none',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result, rerender } = renderHook(
      ({ s }) => useScrollEngine(s, 400, 200, false),
      { initialProps: { s: scroll } }
    );

    expect(result.current.offset).toBe(0);

    // Transition to horizontal
    scroll = { ...scroll, mode: 'horizontal' };
    rerender({ s: scroll });

    expect(result.current.offset).toBe(400);
  });

  it('resets offset using resetOffset', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false, 100)
    );

    act(() => {
      result.current.resetOffset(250);
    });
    expect(result.current.offset).toBe(250);

    act(() => {
      result.current.resetOffset();
    });
    // Default reset for horizontal is containerSize = 400
    expect(result.current.offset).toBe(400);
  });

  it('resets offset to 0 when mode changes to none', () => {
    let scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { result, rerender } = renderHook(
      ({ s }) => useScrollEngine(s, 400, 200, false, 100),
      { initialProps: { s: scroll } }
    );

    expect(result.current.offset).toBe(100);

    scroll = { ...scroll, mode: 'none' };
    rerender({ s: scroll });

    expect(result.current.offset).toBe(0);
  });

  it('cancels requestAnimationFrame on unmount', () => {
    const scroll: PanelScroll = {
      mode: 'horizontal',
      speed: 100,
      loop: true,
      paused: false,
    };

    const { unmount } = renderHook(() =>
      useScrollEngine(scroll, 400, 200, false, 100)
    );

    expect(mockRafCallbacks.size).toBeGreaterThan(0);

    unmount();

    expect(mockRafCallbacks.size).toBe(0);
  });
});
