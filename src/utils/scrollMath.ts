export const MAX_DELTA_MS = 100;

export interface ScrollStepParams {
  mode: 'none' | 'horizontal' | 'vertical';
  currentOffset: number;
  speed: number;
  deltaMs: number;
  containerSize: number;
  contentSize: number;
  loop: boolean;
  paused: boolean;
}

/**
 * Calculates the next scroll offset based on delta time and bounds.
 *
 * Moving left/upward decreases the offset (currentOffset - displacement).
 * When offset reaches or passes -contentSize:
 *   - if loop is true: resets to containerSize
 *   - if loop is false: clamps at -contentSize
 */
export function calculateNextOffset({
  mode,
  currentOffset,
  speed,
  deltaMs,
  containerSize,
  contentSize,
  loop,
  paused,
}: ScrollStepParams): number {
  if (mode === 'none' || paused || speed <= 0) {
    return currentOffset;
  }

  const clampedDelta = Math.max(0, Math.min(deltaMs, MAX_DELTA_MS));
  const displacement = (speed * clampedDelta) / 1000;
  const nextOffset = currentOffset - displacement;

  const bound = -contentSize;
  if (nextOffset <= bound) {
    return loop ? containerSize : bound;
  }

  return nextOffset;
}
