import type { PackSample } from './types';

/**
 * Pick the sample that serves `note` at `velocity`. Prefers a sample whose range
 * covers the note; otherwise the nearest by root note (so packs with gaps still play).
 */
export function pickSample<T extends PackSample>(samples: readonly T[], note: number, velocity = 1): T | undefined {
  const velOk = (s: T) => velocity >= (s.loVel ?? 0) && velocity <= (s.hiVel ?? 1);
  const covering = samples.filter((s) => note >= s.loNote && note <= s.hiNote);
  const pool = covering.length ? covering : samples;
  const byVel = pool.filter(velOk);
  const candidates = byVel.length ? byVel : pool;
  let best: T | undefined;
  for (const s of candidates) {
    if (!best || Math.abs(s.rootNote - note) < Math.abs(best.rootNote - note)) best = s;
  }
  return best;
}
