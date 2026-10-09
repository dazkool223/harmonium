import { describe, expect, it } from 'vitest';
import { Bellows, REFILL_SECONDS } from '../src/instruments/harmonium/bellows';

const run = (b: Bellows, seconds: number, held: number) => {
  for (let t = 0; t < seconds; t += 0.01) b.tick(0.01, held);
};

describe('bellows', () => {
  it('decay off: pressure is constant at the slider', () => {
    const b = new Bellows({ pressure: 0.7, decay: false, airSeconds: 5 });
    run(b, 20, 3);
    expect(b.pressure()).toBeCloseTo(0.7);
  });
  it('decay on: one held note empties in airSeconds', () => {
    const b = new Bellows({ pressure: 1, decay: true, airSeconds: 5 });
    run(b, 2.5, 1);
    expect(b.fill).toBeCloseTo(0.5, 1);
    run(b, 3, 1);
    expect(b.fill).toBe(0);
  });
  it('more notes drain faster', () => {
    const one = new Bellows({ pressure: 1, decay: true, airSeconds: 5 });
    const many = new Bellows({ pressure: 1, decay: true, airSeconds: 5 });
    run(one, 1, 1);
    run(many, 1, 4);
    expect(many.fill).toBeLessThan(one.fill);
  });
  it('refills once keys are lifted', () => {
    const b = new Bellows({ pressure: 0.5, decay: true, airSeconds: 4 });
    run(b, 5, 1);
    expect(b.pressure()).toBe(0);
    run(b, REFILL_SECONDS + 0.05, 0);
    expect(b.pressure()).toBeCloseTo(0.5);
  });
});
