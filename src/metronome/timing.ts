/** Pure metronome maths, separated from the audio scheduler for testing. */

export const LOOKAHEAD_SECONDS = 0.1;
export const TICK_MS = 25;

export interface Beat {
  time: number;
  index: number; // 0-based beat in bar
}

/**
 * Beats due in [now, now + lookahead), starting from the next beat time.
 * Returns the beats and the next unscheduled beat state.
 */
export function beatsInWindow(
  nextTime: number,
  nextIndex: number,
  now: number,
  bpm: number,
  beatsPerBar: number,
  lookahead = LOOKAHEAD_SECONDS,
): { beats: Beat[]; nextTime: number; nextIndex: number } {
  const beats: Beat[] = [];
  const period = 60 / bpm;
  // If we fell far behind (tab suspended), skip missed beats instead of bursting.
  if (nextTime < now - period) {
    const missed = Math.ceil((now - nextTime) / period);
    nextTime += missed * period;
    nextIndex = (nextIndex + missed) % beatsPerBar;
  }
  while (nextTime < now + lookahead) {
    beats.push({ time: nextTime, index: nextIndex });
    nextTime += period;
    nextIndex = (nextIndex + 1) % beatsPerBar;
  }
  return { beats, nextTime, nextIndex };
}

/** Tap tempo: BPM from recent tap timestamps (ms). Taps older than 2 s apart restart. */
export function bpmFromTaps(taps: number[]): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0; i--) {
    if (recent.length && recent[0] - taps[i] > 2000) break;
    recent.unshift(taps[i]);
    if (recent.length === 6) break;
  }
  if (recent.length < 2) return null;
  const avg = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return clampBpm(Math.round(60000 / avg));
}

export function clampBpm(bpm: number): number {
  return Math.min(300, Math.max(30, bpm));
}
