import { describe, it, expect } from 'vitest';
import { calculateNextOffset, MAX_DELTA_MS } from './scrollMath';

describe('scrollMath', () => {
  describe('calculateNextOffset', () => {
    it('does not increment offset when paused or mode is none', () => {
      const res1 = calculateNextOffset({
        mode: 'none',
        currentOffset: 10,
        speed: 50,
        deltaMs: 16,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(res1).toBe(10);

      const res2 = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 10,
        speed: 50,
        deltaMs: 16,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: true,
      });
      expect(res2).toBe(10);
    });

    it('returns currentOffset unchanged when speed is 0 or negative', () => {
      const resZero = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 50,
        speed: 0,
        deltaMs: 16,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(resZero).toBe(50);

      const resNegative = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 50,
        speed: -10,
        deltaMs: 16,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(resNegative).toBe(50);
    });

    it('returns currentOffset unchanged when contentSize is 0 or negative', () => {
      const resZero = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 100,
        speed: 100,
        deltaMs: 16,
        containerSize: 400,
        contentSize: 0,
        loop: true,
        paused: false,
      });
      expect(resZero).toBe(100);

      const resNegative = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 100,
        speed: 100,
        deltaMs: 16,
        containerSize: 400,
        contentSize: -20,
        loop: true,
        paused: false,
      });
      expect(resNegative).toBe(100);
    });

    it('increments offset based on speed and delta time for horizontal scroll', () => {
      // speed 100px/s, 100ms delta => moves 10px left
      const next = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 100,
        speed: 100,
        deltaMs: 100,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(next).toBe(90);
    });

    it('increments offset based on speed and delta time for vertical scroll', () => {
      // speed 50px/s, 200ms clamped to 100ms delta => moves 5px upward
      const next = calculateNextOffset({
        mode: 'vertical',
        currentOffset: 300,
        speed: 50,
        deltaMs: 100,
        containerSize: 600,
        contentSize: 150,
        loop: true,
        paused: false,
      });
      expect(next).toBe(295);
    });

    it('clamps deltaMs to MAX_DELTA_MS (100ms) to avoid teleport jumps after background freeze', () => {
      expect(MAX_DELTA_MS).toBe(100);
      // deltaMs 1000ms clamped to 100ms => speed 100px/s moves 10px instead of 100px
      const next = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 100,
        speed: 100,
        deltaMs: 1000,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(next).toBe(90);
    });

    it('clamps deltaMs to 0 when negative', () => {
      const next = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: 100,
        speed: 100,
        deltaMs: -50,
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(next).toBe(100);
    });

    it('resets to start position when looping past content bounds', () => {
      // When currentOffset <= -contentSize, reset to containerSize
      const next = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: -195,
        speed: 100,
        deltaMs: 100, // moves -10 => -205 <= -200
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(next).toBe(400);
    });

    it('clamps at -contentSize when loop is false and scrolled past bounds', () => {
      const next = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: -195,
        speed: 100,
        deltaMs: 100, // moves -10 => -205 <= -200
        containerSize: 400,
        contentSize: 200,
        loop: false,
        paused: false,
      });
      expect(next).toBe(-200);
    });

    it('handles exact boundary where nextOffset equals -contentSize', () => {
      const nextLoop = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: -190,
        speed: 100,
        deltaMs: 100, // moves -10 => exactly -200
        containerSize: 400,
        contentSize: 200,
        loop: true,
        paused: false,
      });
      expect(nextLoop).toBe(400);

      const nextNoLoop = calculateNextOffset({
        mode: 'horizontal',
        currentOffset: -190,
        speed: 100,
        deltaMs: 100, // moves -10 => exactly -200
        containerSize: 400,
        contentSize: 200,
        loop: false,
        paused: false,
      });
      expect(nextNoLoop).toBe(-200);
    });
  });
});
