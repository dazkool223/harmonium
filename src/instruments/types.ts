/** MIDI note number (60 = C4). */
export type Note = number;

/**
 * The seam every sound source implements. Input sources only ever talk to this,
 * so Phase-2 packs (SFZ/dspreset → PackManifest, SF2 via SpessaSynth) plug in here.
 */
export interface Instrument {
  readonly name: string;
  /** Fetch/decode whatever is needed. Resolves once the instrument can play. */
  load(): Promise<void>;
  /** velocity is 0..1. Starts immediately (no look-ahead) unless `when` is given. */
  noteOn(note: Note, velocity: number, when?: number): void;
  noteOff(note: Note, when?: number): void;
  allNotesOff(): void;
  /** Output node; the engine connects it to the master bus. */
  readonly output: AudioNode;
}

export interface PackSample {
  /** Relative to the manifest URL. */
  url: string;
  /** The note the sample was recorded at. */
  rootNote: Note;
  /** Inclusive note range this sample serves. */
  loNote: Note;
  hiNote: Note;
  /** Inclusive velocity range 0..1 (defaults 0..1). */
  loVel?: number;
  hiVel?: number;
  /** Sustain loop, in seconds from the start of the decoded buffer. Omit for one-shots. */
  loopStart?: number;
  loopEnd?: number;
  /** Fine tuning correction for this sample, in cents. */
  tune?: number;
}

export interface PackEnvelope {
  /** Seconds. */
  attack: number;
  release: number;
}

/** See docs/adr/0001-own-pack-manifest.md. */
export interface PackManifest {
  name: string;
  license?: string;
  source?: string;
  envelope: PackEnvelope;
  samples: PackSample[];
}
