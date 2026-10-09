/**
 * Where a recorded note becomes clearly audible: the first point whose short-term
 * RMS reaches `level` × the note's steady RMS, minus a 1 ms pre-roll. Starting
 * playback there skips silence and the faintest part of the attack, which would
 * otherwise read as key-to-sound delay.
 *
 * `steady` is the [start, end) range in seconds to measure the sustained level
 * (the loop region, when there is one).
 */
export function findAttackOffset(
  data: Float32Array,
  sampleRate: number,
  level: number,
  steady: [number, number],
): number {
  const from = Math.floor(steady[0] * sampleRate);
  const to = Math.min(data.length, Math.floor(steady[1] * sampleRate));
  if (to - from < 16) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += data[i] * data[i];
  const target = level * Math.sqrt(sum / (to - from));
  if (target === 0) return 0;

  const win = Math.max(8, Math.round(sampleRate * 0.002)); // 2 ms window
  let acc = 0;
  for (let i = 0; i < Math.min(data.length, from); i++) {
    acc += data[i] * data[i];
    if (i >= win) acc -= data[i - win] * data[i - win];
    if (i >= win - 1 && Math.sqrt(acc / win) >= target) {
      return Math.max(0, (i - win + 1) / sampleRate - 0.001);
    }
  }
  return 0;
}
