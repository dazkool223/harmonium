import { createReedSource } from '../reed-synth';
import { SampleBank } from '../sampler';
import type { Instrument, Note } from '../types';
import { Bellows, type BellowsSettings } from './bellows';

export type StopId = 'bass' | 'main' | 'high';

interface StopDef {
  id: StopId;
  octave: number;
  level: number;
  /** Max random detune (cents) for the beating "shimmer" between reed banks. */
  shimmer: number;
}

const STOPS: readonly StopDef[] = [
  { id: 'bass', octave: -12, level: 0.75, shimmer: 6 },
  { id: 'main', octave: 0, level: 1, shimmer: 0 },
  { id: 'high', octave: 12, level: 0.5, shimmer: 5 },
];

/** Reeds take a moment to "speak": pitch settles from slightly flat as the reed starts. */
const SPEAK_CENTS = -12;
const SPEAK_SECONDS = 0.07;
/** Fade-in for the synth fallback, which has no recorded attack of its own. */
const SYNTH_ATTACK = 0.06;
/**
 * Samples already carry the reed's natural attack, so their fade-in only needs to
 * avoid a click; softer touch (pen/MIDI) lengthens it a little.
 */
const SAMPLE_DECLICK = 0.005;
const SAMPLE_SOFT_TOUCH_EXTRA = 0.025;
/**
 * Reed attack 0..1 (soft → quick) picks where samples start: the point where they
 * reach 5%…60% of their sustained level. Quicker = less key-to-sound delay but
 * less of the reed's natural swell.
 */
const attackTrimLevel = (quickness: number) => 0.05 + 0.55 * quickness;
const DEFAULT_RELEASE = 0.12;
const BELLOWS_TICK_MS = 30;

type ReedSource = AudioBufferSourceNode | OscillatorNode;

interface Voice {
  source: ReedSource;
  gain: GainNode;
  /** Fixed cents for this voice: sample tune + shimmer. */
  cents: number;
}

/** One sounding key: a voice per enabled stop. */
interface Key {
  velocity: number;
  voices: Map<StopId, Voice>;
}

export class Harmonium implements Instrument {
  readonly name = 'Harmonium';
  readonly output: GainNode;
  /** 'samples' once the pack is decoded; 'synth' until then or if it fails. */
  source: 'samples' | 'synth' = 'synth';

  private readonly pressureGain: GainNode;
  private readonly bank: SampleBank;
  private readonly keys = new Map<Note, Key>();
  private readonly drones = new Map<Note, Key>();
  private readonly stops: Record<StopId, boolean> = { bass: false, main: true, high: false };
  private readonly bellows: Bellows;
  private pitchCents = 0;
  private release = DEFAULT_RELEASE;
  private attackQuickness = 0.5;
  private lastTick = performance.now();
  onPressure?: (pressure: number) => void;

  constructor(private readonly ctx: AudioContext, manifestUrl: string, bellows: BellowsSettings) {
    this.output = ctx.createGain();
    this.output.gain.value = 0.5; // headroom for 3 stops × chords; the engine's limiter catches peaks
    this.pressureGain = ctx.createGain();
    this.pressureGain.connect(this.output);
    this.bank = new SampleBank(ctx, manifestUrl);
    this.bellows = new Bellows(bellows);
    this.pressureGain.gain.value = this.bellows.pressure();
    setInterval(() => this.tickBellows(), BELLOWS_TICK_MS);
  }

  async load(): Promise<void> {
    try {
      await this.bank.load();
      this.bank.trimAttacks(attackTrimLevel(this.attackQuickness));
      const env = this.bank.manifest?.envelope;
      if (env) this.release = env.release;
      this.source = 'samples';
    } catch (err) {
      console.warn('Harmonium samples unavailable, using synthesized reeds.', err);
      this.source = 'synth';
    }
  }

  noteOn(note: Note, velocity: number, when = 0): void {
    this.startKey(this.keys, note, velocity, when);
  }

  noteOff(note: Note, when = 0): void {
    this.stopKey(this.keys, note, when);
  }

  allNotesOff(): void {
    for (const note of [...this.keys.keys()]) this.noteOff(note);
  }

  get heldCount(): number {
    return this.keys.size;
  }

  setStop(id: StopId, on: boolean): void {
    if (this.stops[id] === on) return;
    this.stops[id] = on;
    // Stops act on keys already held, like pulling a real stop mid-chord.
    for (const [note, key] of [...this.keys, ...this.drones]) {
      if (on) key.voices.set(id, this.startVoice(note, STOPS.find((s) => s.id === id)!, key.velocity, 0));
      else {
        const v = key.voices.get(id);
        if (v) this.stopVoice(v, 0);
        key.voices.delete(id);
      }
    }
  }

  /** Transpose + master tuning, in cents; applies to sounding notes too. */
  setPitchCents(cents: number): void {
    this.pitchCents = cents;
    const t = this.ctx.currentTime;
    for (const key of [...this.keys.values(), ...this.drones.values()]) {
      for (const v of key.voices.values()) {
        v.source.detune.cancelScheduledValues(t);
        v.source.detune.setTargetAtTime(cents + v.cents, t, 0.01);
      }
    }
  }

  /** 0 = full natural reed swell, 1 = quickest response. Applies to new notes. */
  setAttack(quickness: number): void {
    this.attackQuickness = quickness;
    if (this.source === 'samples') this.bank.trimAttacks(attackTrimLevel(quickness));
  }

  setBellows(settings: BellowsSettings): void {
    this.bellows.settings = settings;
  }

  /** Drone notes sound until turned off; they don't use bellows air in decay mode. */
  setDrone(notes: Note[]): void {
    for (const note of [...this.drones.keys()]) {
      if (!notes.includes(note)) this.stopKey(this.drones, note, 0);
    }
    for (const note of notes) {
      if (!this.drones.has(note)) this.startKey(this.drones, note, 0.7, 0);
    }
  }

  private startKey(map: Map<Note, Key>, note: Note, velocity: number, when: number): void {
    this.stopKey(map, note, when);
    const voices = new Map<StopId, Voice>();
    for (const stop of STOPS) {
      if (this.stops[stop.id]) voices.set(stop.id, this.startVoice(note, stop, velocity, when));
    }
    map.set(note, { velocity, voices });
  }

  private stopKey(map: Map<Note, Key>, note: Note, when: number): void {
    const key = map.get(note);
    if (!key) return;
    map.delete(note);
    for (const v of key.voices.values()) this.stopVoice(v, when);
  }

  private startVoice(note: Note, stop: StopDef, velocity: number, when: number): Voice {
    const ctx = this.ctx;
    const t = Math.max(when, ctx.currentTime);
    const sounding = note + stop.octave;
    let source: ReedSource;
    let cents = stop.shimmer ? (Math.random() * 2 - 1) * stop.shimmer : 0;

    const made = this.source === 'samples' ? this.bank.createSource(sounding, velocity) : null;
    if (made) {
      source = made.source;
      cents += made.sample.tune ?? 0;
    } else {
      source = createReedSource(ctx, sounding);
    }

    // Harmonium dynamics come from the bellows; key velocity only colours it a little.
    const level = stop.level * (0.65 + 0.35 * velocity);
    const attack = made
      ? SAMPLE_DECLICK + SAMPLE_SOFT_TOUCH_EXTRA * (1 - velocity)
      : SYNTH_ATTACK * (1.25 - 0.5 * velocity);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + attack);

    const target = this.pitchCents + cents;
    source.detune.setValueAtTime(target + SPEAK_CENTS, t);
    source.detune.linearRampToValueAtTime(target, t + SPEAK_SECONDS);

    source.connect(gain).connect(this.pressureGain);
    if (made) made.source.start(t, made.sample.startOffset);
    else source.start(t);
    return { source, gain, cents };
  }

  private stopVoice(v: Voice, when: number): void {
    const t = Math.max(when, this.ctx.currentTime);
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.setTargetAtTime(0, t, this.release / 3);
    v.source.stop(t + this.release * 3);
    v.source.onended = () => v.gain.disconnect();
  }

  private tickBellows(): void {
    const now = performance.now();
    const dt = Math.min(0.2, (now - this.lastTick) / 1000);
    this.lastTick = now;
    const pressure = this.bellows.tick(dt, this.keys.size);
    // Perceptual curve so the pressure slider feels even.
    this.pressureGain.gain.setTargetAtTime(pressure * pressure, this.ctx.currentTime, 0.04);
    this.onPressure?.(pressure);
  }
}
