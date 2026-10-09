import { describe, expect, it } from 'vitest';
import { inScale, noteLabel, scaleById, isBlackKey } from '../src/music/scales';

describe('scales', () => {
  it('bilawal from C is the white keys', () => {
    const s = scaleById('bilawal');
    const ins = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map((n) => inScale(n, 0, s));
    expect(ins).toEqual([true, false, true, false, true, true, false, true, false, true, false, true]);
  });
  it('moves with Sa', () => {
    const s = scaleById('bilawal');
    expect(inScale(66, 2, s)).toBe(true); // F# is Ga in D major
    expect(inScale(65, 2, s)).toBe(false);
  });
  it('sargam labels follow Sa; western does not', () => {
    expect(noteLabel(62, 2, 'sargam')).toBe('Sa');
    expect(noteLabel(61, 2, 'sargam')).toBe('Ni');
    expect(noteLabel(66, 0, 'sargam')).toBe('ma');
    expect(noteLabel(62, 2, 'western')).toBe('D');
    expect(noteLabel(-1, 0, 'western')).toBe('B');
  });
  it('unknown scale falls back to chromatic', () => {
    expect(scaleById('nope').degrees).toHaveLength(12);
  });
  it('black keys', () => {
    expect([60, 61, 62, 63, 64].map(isBlackKey)).toEqual([false, true, false, true, false]);
  });
});
