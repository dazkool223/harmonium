import type { Instrument, Note } from '../instruments/types';

export interface RouterOptions {
  /** Return false to silence a note (out of range, or out of scale when locked). */
  canPlay(note: Note): boolean;
  /** Visual feedback: a note became held or fully released. */
  onChange?(note: Note, held: boolean): void;
}

/**
 * Funnels every Input source into the Instrument. The same note can be held by
 * several sources at once (a key and a finger); it sounds once and stops when
 * the last holder lets go.
 */
export class NoteRouter {
  private holders = new Map<Note, Set<string>>();

  constructor(public instrument: Instrument, private opts: RouterOptions) {}

  press(holder: string, note: Note, velocity: number): void {
    if (!this.opts.canPlay(note)) return;
    let set = this.holders.get(note);
    if (!set) {
      set = new Set();
      this.holders.set(note, set);
    }
    if (set.has(holder)) return;
    set.add(holder);
    if (set.size === 1) {
      this.instrument.noteOn(note, velocity);
      this.opts.onChange?.(note, true);
    }
  }

  release(holder: string, note: Note): void {
    const set = this.holders.get(note);
    if (!set?.delete(holder)) return;
    if (set.size === 0) {
      this.holders.delete(note);
      this.instrument.noteOff(note);
      this.opts.onChange?.(note, false);
    }
  }

  releaseAll(): void {
    for (const note of [...this.holders.keys()]) {
      this.holders.delete(note);
      this.instrument.noteOff(note);
      this.opts.onChange?.(note, false);
    }
  }

  isHeld(note: Note): boolean {
    return this.holders.has(note);
  }
}
