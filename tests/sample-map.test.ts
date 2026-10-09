import { describe, expect, it } from 'vitest';
import { pickSample } from '../src/instruments/sample-map';

const s = (root: number, lo: number, hi: number, loVel?: number, hiVel?: number) => ({ url: `${root}`, rootNote: root, loNote: lo, hiNote: hi, loVel, hiVel });

describe('pickSample', () => {
  const samples = [s(48, 36, 49), s(51, 50, 52), s(54, 53, 77)];
  it('uses the covering sample', () => {
    expect(pickSample(samples, 50)?.rootNote).toBe(51);
    expect(pickSample(samples, 36)?.rootNote).toBe(48);
  });
  it('falls back to nearest root outside all ranges', () => {
    expect(pickSample(samples, 90)?.rootNote).toBe(54);
  });
  it('respects velocity layers', () => {
    const layered = [s(60, 0, 127, 0, 0.5), s(60, 0, 127, 0.5, 1)];
    expect(pickSample(layered, 60, 0.2)?.loVel).toBe(0);
    expect(pickSample(layered, 60, 0.9)?.loVel).toBe(0.5);
  });
  it('empty pack', () => {
    expect(pickSample([], 60)).toBeUndefined();
  });
});
