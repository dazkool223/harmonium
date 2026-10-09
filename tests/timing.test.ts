import { describe, expect, it } from 'vitest';
import { beatsInWindow, bpmFromTaps, clampBpm } from '../src/metronome/timing';

describe('metronome timing', () => {
  it('schedules beats inside the look-ahead window', () => {
    const r = beatsInWindow(1, 0, 1, 600, 4, 0.25); // 0.1 s period
    expect(r.beats.map((b) => b.index)).toEqual([0, 1, 2]);
    expect(r.beats[2].time).toBeCloseTo(1.2);
    expect(r.nextIndex).toBe(3);
  });
  it('wraps the bar', () => {
    const r = beatsInWindow(0, 3, 0, 600, 4, 0.15);
    expect(r.beats.map((b) => b.index)).toEqual([3, 0]);
  });
  it('skips beats missed while suspended', () => {
    const r = beatsInWindow(0, 0, 10, 60, 4, 0.1);
    expect(r.beats).toHaveLength(1);
    expect(r.beats[0].time).toBeGreaterThanOrEqual(10);
    expect(r.beats[0].index).toBe(2); // 10 beats later -> index 10 % 4
  });
  it('tap tempo', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
    expect(bpmFromTaps([0, 5000, 5500])).toBe(120); // stale tap ignored
    expect(bpmFromTaps([100])).toBeNull();
  });
  it('clamps bpm', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(300);
  });
});
