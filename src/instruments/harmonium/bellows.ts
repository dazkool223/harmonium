export interface BellowsSettings {
  /** Player's pressure, 0..1 (the "velocity" slider). */
  pressure: number;
  /** When on, held notes use up air and lifting all keys refills it. */
  decay: boolean;
  /** Seconds a full bellows lasts with one note held (4..10). */
  airSeconds: number;
}

/** Seconds to refill from empty once no keys are held. */
export const REFILL_SECONDS = 1;
/** Each extra held note drains this much faster, capped. */
const EXTRA_NOTE_DRAIN = 0.15;
const MAX_DRAIN_MULTIPLIER = 2;

/**
 * Pure bellows model. `fill` is the fraction of air left (0..1); effective
 * pressure is fill × the player's pressure.
 */
export class Bellows {
  fill = 1;

  constructor(public settings: BellowsSettings) {}

  tick(dt: number, heldCount: number): number {
    const s = this.settings;
    if (!s.decay) {
      this.fill = 1;
    } else if (heldCount > 0) {
      const mult = Math.min(MAX_DRAIN_MULTIPLIER, 1 + EXTRA_NOTE_DRAIN * (heldCount - 1));
      this.fill = Math.max(0, this.fill - (dt / s.airSeconds) * mult);
    } else {
      this.fill = Math.min(1, this.fill + dt / REFILL_SECONDS);
    }
    return this.pressure();
  }

  pressure(): number {
    return this.fill * this.settings.pressure;
  }
}
