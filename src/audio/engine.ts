import { makeImpulseResponse } from './reverb';

/**
 * One AudioContext for the app. Instruments connect to `instrumentBus`
 * (dry + reverb); the metronome connects to `clickBus` (dry only).
 *
 *   instrumentBus ─┬─ dry ─────────────┬─ master ─ limiter ─ destination
 *                  └─ convolver ─ wet ─┘     ▲
 *   clickBus ────────────────────────────────┘
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly instrumentBus: GainNode;
  readonly clickBus: GainNode;
  private readonly master: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly convolver: ConvolverNode;
  private reverbSeconds = 0;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    this.instrumentBus = ctx.createGain();
    this.clickBus = ctx.createGain();
    this.master = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.convolver = ctx.createConvolver();

    // Gentle safety limiter so stacked reeds + drone don't clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;

    this.instrumentBus.connect(this.dry).connect(this.master);
    this.instrumentBus.connect(this.convolver).connect(this.wet).connect(this.master);
    this.clickBus.connect(this.master);
    this.master.connect(limiter).connect(ctx.destination);
  }

  /** Must be called from a user gesture (autoplay policy). */
  resume(): Promise<void> {
    return this.ctx.state === 'running' ? Promise.resolve() : this.ctx.resume();
  }

  setVolume(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  /** mix 0..1 (equal-power), size in seconds. */
  setReverb(mix: number, seconds: number): void {
    const t = this.ctx.currentTime;
    this.dry.gain.setTargetAtTime(Math.cos((mix * Math.PI) / 2), t, 0.02);
    this.wet.gain.setTargetAtTime(Math.sin((mix * Math.PI) / 2) * 0.8, t, 0.02);
    if (Math.abs(seconds - this.reverbSeconds) > 0.05) {
      this.reverbSeconds = seconds;
      this.convolver.buffer = makeImpulseResponse(this.ctx, seconds);
    }
  }

  /** Total key-to-ear estimate in ms, or null before the context runs. */
  latencyMs(): { total: number; output: boolean } | null {
    if (this.ctx.state !== 'running') return null;
    const base = this.ctx.baseLatency ?? 0;
    const out = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency;
    return { total: Math.round((base + (out ?? 0)) * 1000), output: out !== undefined && out > 0 };
  }
}
