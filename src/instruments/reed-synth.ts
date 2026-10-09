import { noteToHz } from '../music/pitch';

const waves = new WeakMap<BaseAudioContext, PeriodicWave>();

/**
 * Free-reed spectrum: a buzzy, harmonically rich tone (the reed chops the airflow)
 * with a broad body resonance around harmonics 3–6.
 */
function reedWave(ctx: BaseAudioContext): PeriodicWave {
  let wave = waves.get(ctx);
  if (wave) return wave;
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let h = 1; h < n; h++) {
    const rolloff = 1 / Math.pow(h, 0.9);
    const body = 1 + 0.6 * Math.exp(-((h - 4.5) ** 2) / 6);
    imag[h] = rolloff * body * (h % 2 ? 1 : 0.7);
  }
  wave = ctx.createPeriodicWave(real, imag);
  waves.set(ctx, wave);
  return wave;
}

/** Fallback voice used until/unless samples load. Detune works as on sample voices. */
export function createReedSource(ctx: BaseAudioContext, note: number): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(reedWave(ctx));
  osc.frequency.value = noteToHz(note);
  return osc;
}
