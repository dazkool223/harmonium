import { describe, expect, it } from 'vitest';
import { findAttackOffset } from '../src/instruments/attack';

const SR = 10000;

/** Silence, then a linear swell to full level, then steady sine. */
function note(silenceS: number, swellS: number, totalS: number): Float32Array {
  const out = new Float32Array(Math.round(totalS * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = t < silenceS ? 0 : Math.min(1, (t - silenceS) / swellS);
    out[i] = env * Math.sin(2 * Math.PI * 200 * t);
  }
  return out;
}

describe('findAttackOffset', () => {
  it('skips leading silence and the faintest part of the swell', () => {
    const data = note(0.01, 0.04, 1);
    const at = findAttackOffset(data, SR, 0.25, [0.5, 0.9]);
    // 25% of full level is reached 10 ms into the 40 ms swell, i.e. ~20 ms in.
    expect(at).toBeGreaterThan(0.015);
    expect(at).toBeLessThan(0.022);
  });
  it('returns 0 for a note that starts at full level', () => {
    expect(findAttackOffset(note(0, 0.0001, 1), SR, 0.25, [0.5, 0.9])).toBe(0);
  });
  it('returns 0 for silence or a bad steady range', () => {
    expect(findAttackOffset(new Float32Array(SR), SR, 0.25, [0.5, 0.9])).toBe(0);
    expect(findAttackOffset(note(0.01, 0.04, 1), SR, 0.25, [0.9, 0.9])).toBe(0);
  });
});
