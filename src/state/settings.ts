import { DEFAULT_WINDOW_BASE } from '../input/keymap';
import type { LabelMode } from '../music/scales';

/** What the on-screen keys show: note names, computer-keyboard letters, both, or nothing. */
export type KeyLabels = 'both' | 'notes' | 'keys' | 'none';

export interface Settings {
  // Sound
  pressure: number; // 0..1
  bellowsDecay: boolean;
  airSeconds: number; // 4..10
  stopBass: boolean;
  stopMain: boolean;
  stopHigh: boolean;
  drone: boolean;
  dronePa: boolean;
  volume: number; // 0..1 master
  reedAttack: number; // 0 soft (natural swell) .. 1 quick
  // Pitch
  a4Hz: number; // 430..450
  transpose: number; // -12..12
  windowBase: number; // MIDI note of Z
  // Scale
  sa: number; // pitch class 0..11
  scaleId: string;
  scaleLock: boolean;
  labelMode: LabelMode;
  keyLabels: KeyLabels;
  // Reverb
  reverbMix: number; // 0..1
  reverbSize: number; // seconds 0.5..5
  // Metronome
  bpm: number;
  beatsPerBar: number;
  accent: boolean;
  metronomeVolume: number;
}

export const DEFAULTS: Settings = {
  pressure: 0.8,
  bellowsDecay: false,
  airSeconds: 7,
  stopBass: false,
  stopMain: true,
  stopHigh: false,
  drone: false,
  dronePa: false,
  volume: 0.8,
  reedAttack: 0.5,
  a4Hz: 440,
  transpose: 0,
  windowBase: DEFAULT_WINDOW_BASE,
  sa: 0,
  scaleId: 'chromatic',
  scaleLock: false,
  labelMode: 'sargam',
  keyLabels: 'both',
  reverbMix: 0.25,
  reverbSize: 2,
  bpm: 90,
  beatsPerBar: 4,
  accent: true,
  metronomeVolume: 0.6,
};

const STORAGE_KEY = 'web-harmonium:settings:v1';

type Listener = (s: Settings, changed: Partial<Settings>) => void;

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * App settings, saved to localStorage on every change so they survive closing
 * the tab or the whole browser. Writes are synchronous and tiny (~1 KB), so
 * there's no debounce to lose changes made just before closing.
 */
export class SettingsStore {
  private state: Settings;
  private listeners = new Set<Listener>();
  /** False when the browser blocks storage (e.g. some private modes). */
  canSave = true;

  constructor(private storage: StorageLike | null = defaultStorage()) {
    this.state = { ...DEFAULTS, ...this.load() };
  }

  get(): Readonly<Settings> {
    return this.state;
  }

  set(patch: Partial<Settings>): void {
    this.state = { ...this.state, ...patch };
    this.save();
    for (const l of this.listeners) l(this.state, patch);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  reset(): void {
    this.set({ ...DEFAULTS });
  }

  private load(): Partial<Settings> {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Keep only known keys with the right type, so old/corrupt data can't break us.
      const out: Partial<Settings> = {};
      for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
        if (typeof parsed[key] === typeof DEFAULTS[key]) (out as Record<string, unknown>)[key] = parsed[key];
      }
      return out;
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      if (!this.storage) throw new Error('no storage');
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.canSave = true;
    } catch {
      this.canSave = false; // storage full or blocked; the app still works, it just won't remember
    }
  }
}
