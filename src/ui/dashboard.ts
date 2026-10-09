import { SCALES, pitchClassName } from '../music/scales';
import { button, el, type Controls } from './controls';

export interface DashboardActions {
  shiftOctave(dir: -1 | 1): void;
  tap(): void;
  midi?: () => void;
  reset(): void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
const noteName = (n: number) => `${pitchClassName(n)}${Math.floor(n / 12) - 1}`;

function group(title: string, ...children: HTMLElement[]): HTMLElement {
  const g = el('fieldset', 'group');
  g.append(el('legend', '', title), ...children);
  return g;
}

/** The settings panel. Every control writes to the settings store; main.ts reacts. */
export function buildDashboard(c: Controls, actions: DashboardActions): HTMLElement {
  const panel = el('section', 'dashboard');
  panel.id = 'dashboard';
  panel.setAttribute('aria-label', 'Settings');

  const air = c.slider('airSeconds', 'Air lasts', 4, 10, 0.5, (v) => `${v} s`);
  c.watch((s) => air.classList.toggle('disabled', !s.bellowsDecay));
  const dronePa = c.toggle('dronePa', 'Add Pa to drone');
  c.watch((s) => dronePa.classList.toggle('disabled', !s.drone));

  const stops = el('div', 'row');
  stops.append(c.toggle('stopBass', 'Bass'), c.toggle('stopMain', 'Main'), c.toggle('stopHigh', 'High'));

  const octaveOut = el('output', 'ctl-value');
  c.watch((s) => (octaveOut.textContent = `Z = ${noteName(s.windowBase)}`));
  const octave = el('div', 'ctl stepper');
  octave.append(
    el('span', 'ctl-label', 'Keyboard octave'),
    octaveOut,
    button('−', () => actions.shiftOctave(-1), 'btn small'),
    button('+', () => actions.shiftOctave(1), 'btn small'),
  );

  const tap = button('Tap tempo', actions.tap, 'btn');
  const beats: [number, string][] = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16].map((n) => [n, String(n)]);

  const extras = el('div', 'row');
  if (actions.midi) extras.append(button('Connect MIDI', actions.midi, 'btn'));
  extras.append(button('Reset settings', actions.reset, 'btn quiet'));

  panel.append(
    group(
      'Sound',
      c.slider('pressure', 'Air pressure', 0, 1, 0.01, pct),
      c.toggle('bellowsDecay', 'Bellows run out of air'),
      air,
      el('span', 'sublabel', 'Reed stops'),
      stops,
      c.toggle('drone', 'Drone on Sa'),
      dronePa,
      c.slider('reedAttack', 'Reed attack', 0, 1, 0.05, (v) => (v < 0.34 ? 'soft' : v < 0.67 ? 'medium' : 'quick')),
      c.slider('volume', 'Volume', 0, 1, 0.01, pct),
    ),
    group(
      'Pitch',
      c.slider('a4Hz', 'Tuning (A4)', 430, 450, 0.5, (v) => `${v} Hz`),
      c.slider('transpose', 'Transpose', -12, 12, 1, (v) => `${signed(v)} st`),
      octave,
    ),
    group(
      'Scale',
      c.select('sa', 'Sa', Array.from({ length: 12 }, (_, i) => [i, pitchClassName(i)])),
      c.select('scaleId', 'Scale', SCALES.map((s) => [s.id, s.name])),
      c.toggle('scaleLock', 'Silence notes outside the scale'),
      c.select('keyLabels', 'Show on keys', [
        ['both', 'Notes and keyboard keys'],
        ['notes', 'Notes only'],
        ['keys', 'Keyboard keys only'],
        ['none', 'Nothing'],
      ]),
      c.select('labelMode', 'Note names', [
        ['sargam', 'Sargam (Sa Re Ga)'],
        ['western', 'Western (C D E)'],
      ]),
    ),
    group(
      'Reverb',
      c.slider('reverbMix', 'Amount', 0, 1, 0.01, pct),
      c.slider('reverbSize', 'Room size', 0.5, 5, 0.1, (v) => `${v.toFixed(1)} s`),
    ),
    group(
      'Metronome',
      c.slider('bpm', 'Tempo', 30, 300, 1, (v) => `${v} bpm`),
      c.select('beatsPerBar', 'Beats per bar', beats),
      c.toggle('accent', 'Accent the first beat'),
      tap,
      c.slider('metronomeVolume', 'Click volume', 0, 1, 0.01, pct),
    ),
    extras,
  );
  return panel;
}
