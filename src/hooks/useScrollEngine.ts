import { useState, useEffect, useRef, useCallback } from 'react';
import { PanelScroll } from '../types/panel';
import { calculateNextOffset } from '../utils/scrollMath';

export interface UseScrollEngineResult {
  offset: number;
  isPaused: boolean;
  togglePause: () => void;
  resetOffset: (newOffset?: number) => void;
}

/**
 * React hook driving smooth scrolling animations with timestamp deltas via requestAnimationFrame.
 *
 * @param scrollConfig Configuration for mode ('none' | 'horizontal' | 'vertical'), speed, loop, and paused
 * @param containerSize Viewport width or height depending on mode
 * @param contentSize Inner content width or height depending on mode
 * @param globalPaused Global pause flag (e.g. from app state or global shortcut)
 * @param initialOffset Optional custom initial offset
 */
export function useScrollEngine(
  scrollConfig: PanelScroll,
  containerSize: number,
  contentSize: number,
  globalPaused: boolean = false,
  initialOffset?: number
): UseScrollEngineResult {
  const getDefaultOffset = useCallback(
    () => (scrollConfig.mode === 'none' ? 0 : containerSize),
    [scrollConfig.mode, containerSize]
  );

  const [offset, setOffset] = useState<number>(() =>
    initialOffset !== undefined ? initialOffset : getDefaultOffset()
  );

  const [localOverride, setLocalOverride] = useState<boolean | null>(null);

  // Reset local override when external scrollConfig.paused changes
  useEffect(() => {
    setLocalOverride(null);
  }, [scrollConfig.paused]);

  const isPaused = Boolean(
    globalPaused || (localOverride !== null ? localOverride : scrollConfig.paused)
  );

  const togglePause = useCallback(() => {
    setLocalOverride((prev) => {
      const current = prev !== null ? prev : scrollConfig.paused;
      return !current;
    });
  }, [scrollConfig.paused]);

  const resetOffset = useCallback(
    (newOffset?: number) => {
      setOffset(newOffset !== undefined ? newOffset : getDefaultOffset());
    },
    [getDefaultOffset]
  );

  // Handle mode transitions: reset to 0 when entering 'none', reset to containerSize when leaving 'none'
  const prevModeRef = useRef(scrollConfig.mode);
  useEffect(() => {
    if (prevModeRef.current !== scrollConfig.mode) {
      if (scrollConfig.mode === 'none') {
        setOffset(0);
      } else if (prevModeRef.current === 'none') {
        setOffset(containerSize);
      }
      prevModeRef.current = scrollConfig.mode;
    }
  }, [scrollConfig.mode, containerSize]);

  // Keep latest parameters in ref so rAF loop always has current state without restarting
  const paramsRef = useRef({
    scrollConfig,
    containerSize,
    contentSize,
    isPaused,
  });

  useEffect(() => {
    paramsRef.current = {
      scrollConfig,
      containerSize,
      contentSize,
      isPaused,
    };
  }, [scrollConfig, containerSize, contentSize, isPaused]);

  // Animation frame loop: avoids scheduling frames when mode is 'none'
  useEffect(() => {
    if (scrollConfig.mode === 'none') {
      return;
    }

    let lastTime: number | null = null;
    let rafId: number | null = null;

    const frame = (time: DOMHighResTimeStamp) => {
      if (lastTime === null) {
        lastTime = time;
      }
      const deltaMs = time - lastTime;
      lastTime = time;

      const current = paramsRef.current;
      if (!current.isPaused && current.scrollConfig.mode !== 'none') {
        setOffset((prev) =>
          calculateNextOffset({
            mode: current.scrollConfig.mode,
            currentOffset: prev,
            speed: current.scrollConfig.speed,
            deltaMs,
            containerSize: current.containerSize,
            contentSize: current.contentSize,
            loop: current.scrollConfig.loop,
            paused: current.isPaused,
          })
        );
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [scrollConfig.mode]);

  return {
    offset,
    isPaused,
    togglePause,
    resetOffset,
  };
}
