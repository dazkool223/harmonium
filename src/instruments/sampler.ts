import { playbackRateFor } from '../music/pitch';
import { findAttackOffset } from './attack';
import { pickSample } from './sample-map';
import type { Instrument, Note, PackManifest, PackSample } from './types';

export interface LoadedSample extends PackSample {
  buffer: AudioBuffer;
  /** Seconds into the buffer where playback starts (see trimAttacks). */
  startOffset: number;
}

/** A Pack manifest with its audio decoded. */
export class SampleBank {
  samples: LoadedSample[] = [];
  manifest: PackManifest | null = null;

  constructor(private ctx: BaseAudioContext, private manifestUrl: string) {}

  async load(): Promise<void> {
    const res = await fetch(this.manifestUrl);
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    const manifest = (await res.json()) as PackManifest;
    const base = new URL(this.manifestUrl, location.href);
    this.samples = await Promise.all(
      manifest.samples.map(async (s) => {
        const r = await fetch(new URL(s.url, base));
        if (!r.ok) throw new Error(`${s.url} ${r.status}`);
        const buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
        return { ...s, buffer, startOffset: 0 };
      }),
    );
    this.manifest = manifest;
  }

  /**
   * Start each sample where it reaches `level` × its sustained level, trading the
   * faintest part of the recorded attack for a faster key response.
   */
  trimAttacks(level: number): void {
    for (const s of this.samples) {
      const steady: [number, number] =
        s.loopStart !== undefined && s.loopEnd !== undefined ? [s.loopStart, s.loopEnd] : [0.3, 0.6];
      s.startOffset = findAttackOffset(s.buffer.getChannelData(0), s.buffer.sampleRate, level, steady);
    }
  }

  /** A looping source re-pitched to `note`; caller connects, starts and stops it. */
  createSource(note: Note, velocity = 1): { source: AudioBufferSourceNode; sample: LoadedSample } | null {
    const sample = pickSample(this.samples, note, velocity);
    if (!sample) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = playbackRateFor(note, sample.rootNote);
    if (sample.loopStart !== undefined && sample.loopEnd !== undefined) {
      source.loop = true;
      source.loopStart = sample.loopStart;
      source.loopEnd = sample.loopEnd;
    }
    return { source, sample };
  }
}

/**
 * Generic manifest-driven Instrument (the Phase-2 path for imported packs).
 * The Harmonium uses SampleBank directly because it layers reed stops.
 */
export class SamplerInstrument implements Instrument {
  readonly output: GainNode;
  private bank: SampleBank;
  private voices = new Map<Note, { source: AudioBufferSourceNode; gain: GainNode }>();

  constructor(private ctx: AudioContext, manifestUrl: string, readonly name: string) {
    this.output = ctx.createGain();
    this.bank = new SampleBank(ctx, manifestUrl);
  }

  load(): Promise<void> {
    return this.bank.load();
  }

  noteOn(note: Note, velocity: number, when = 0): void {
    this.noteOff(note, when);
    const made = this.bank.createSource(note, velocity);
    if (!made) return;
    const env = this.bank.manifest!.envelope;
    const t = Math.max(when, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(velocity, t + env.attack);
    made.source.detune.value = made.sample.tune ?? 0;
    made.source.connect(gain).connect(this.output);
    made.source.start(t, made.sample.startOffset);
    this.voices.set(note, { source: made.source, gain });
  }

  noteOff(note: Note, when = 0): void {
    const v = this.voices.get(note);
    if (!v) return;
    this.voices.delete(note);
    const t = Math.max(when, this.ctx.currentTime);
    const release = this.bank.manifest!.envelope.release;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, release / 3);
    v.source.stop(t + release * 2);
  }

  allNotesOff(): void {
    for (const note of [...this.voices.keys()]) this.noteOff(note);
  }
}
