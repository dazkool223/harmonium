import { describe, expect, it } from 'vitest';
import { pitchOffsetCents, playbackRateFor, noteToHz } from '../src/music/pitch';

describe('pitch', () => {
  it('transpose is 100 cents per semitone', () => {
    expect(pitchOffsetCents(3, 440)).toBeCloseTo(300);
    expect(pitchOffsetCents(-12, 440)).toBeCloseTo(-1200);
  });
  it('master tuning converts Hz to cents', () => {
    expect(pitchOffsetCents(0, 880)).toBeCloseTo(1200);
    expect(pitchOffsetCents(0, 432)).toBeCloseTo(-31.77, 1);
  });
  it('playback rate', () => {
    expect(playbackRateFor(72, 60)).toBeCloseTo(2);
    expect(playbackRateFor(57, 60)).toBeCloseTo(0.8409, 3);
  });
  it('note to Hz', () => {
    expect(noteToHz(69)).toBe(440);
    expect(noteToHz(60)).toBeCloseTo(261.63, 1);
  });
});
