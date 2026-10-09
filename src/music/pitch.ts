/** Cents to shift a voice by, given transpose (semitones) and master tuning (A4 in Hz). */
export function pitchOffsetCents(transpose: number, a4Hz: number): number {
  return transpose * 100 + 1200 * Math.log2(a4Hz / 440);
}

/** Playback rate to turn a sample recorded at `rootNote` into `note`, before detune. */
export function playbackRateFor(note: number, rootNote: number): number {
  return Math.pow(2, (note - rootNote) / 12);
}

export function noteToHz(note: number, a4Hz = 440): number {
  return a4Hz * Math.pow(2, (note - 69) / 12);
}
