/**
 * Generated stereo impulse response: decorrelated noise with an exponential
 * decay reaching -60 dB at `seconds`, darkening over time like a real room.
 */
export function makeImpulseResponse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const ir = ctx.createBuffer(2, length, rate);
  const predelay = Math.floor(rate * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp = 0;
    for (let i = predelay; i < length; i++) {
      const t = (i - predelay) / rate;
      const env = Math.pow(10, (-3 * t) / seconds); // -60 dB at `seconds`
      // One-pole lowpass whose cutoff falls with time: high frequencies die first.
      const k = 0.15 + 0.8 * Math.exp((-4 * t) / seconds);
      lp += k * (Math.random() * 2 - 1 - lp);
      data[i] = lp * env;
    }
  }
  return ir;
}
