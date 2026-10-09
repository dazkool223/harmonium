import { beatsInWindow, type Beat, TICK_MS } from './timing';

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  accent: boolean;
  volume: number;
}

/**
 * "A Tale of Two Clocks": a Worker tick every 25 ms schedules clicks 100 ms
 * ahead on the audio clock, so timing never depends on main-thread jitter.
 */
export class Metronome {
  running = false;
  /** Called (on the main thread, in step with the audio) for each beat. */
  onBeat?: (index: number) => void;

  private worker: Worker;
  private nextTime = 0;
  private nextIndex = 0;
  private pending: Beat[] = [];
  private raf = 0;
  private out: GainNode;

  constructor(private ctx: AudioContext, destination: AudioNode, private settings: MetronomeSettings) {
    this.out = ctx.createGain();
    this.out.gain.value = settings.volume;
    this.out.connect(destination);
    this.worker = new Worker(new URL('./ticker.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = () => this.schedule();
  }

  update(settings: MetronomeSettings): void {
    this.settings = settings;
    this.out.gain.setTargetAtTime(settings.volume, this.ctx.currentTime, 0.02);
    if (this.nextIndex >= settings.beatsPerBar) this.nextIndex = 0;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.nextIndex = 0;
    this.pending = [];
    this.worker.postMessage({ cmd: 'start', interval: TICK_MS });
    this.schedule();
    this.raf = requestAnimationFrame(this.drawLoop);
  }

  stop(): void {
    this.running = false;
    this.worker.postMessage({ cmd: 'stop' });
    cancelAnimationFrame(this.raf);
    this.pending = [];
  }

  toggle(): void {
    if (this.running) this.stop();
    else this.start();
  }

  private schedule(): void {
    if (!this.running) return;
    const r = beatsInWindow(this.nextTime, this.nextIndex, this.ctx.currentTime, this.settings.bpm, this.settings.beatsPerBar);
    this.nextTime = r.nextTime;
    this.nextIndex = r.nextIndex;
    for (const beat of r.beats) {
      this.click(beat);
      this.pending.push(beat);
    }
  }

  private click({ time, index }: Beat): void {
    const accent = this.settings.accent && index === 0;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1175;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(accent ? 1 : 0.6, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(env).connect(this.out);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  /** Visual beat follows the audio clock, not the timer. */
  private drawLoop = (): void => {
    const now = this.ctx.currentTime;
    while (this.pending.length && this.pending[0].time <= now) {
      this.onBeat?.(this.pending.shift()!.index);
    }
    if (this.running) this.raf = requestAnimationFrame(this.drawLoop);
  };
}
