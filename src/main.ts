import './ui/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { AudioEngine } from './audio/engine';
import { Harmonium } from './instruments/harmonium/harmonium';
import { attachKeyboard } from './input/keyboard';
import { clampWindowBase, KEYBOARD_HIGH, KEYBOARD_LOW } from './input/keymap';
import { enableMidi, midiSupported } from './input/midi';
import { attachPointer } from './input/pointer';
import { NoteRouter } from './input/router';
import { Metronome } from './metronome/metronome';
import { bpmFromTaps } from './metronome/timing';
import { pitchOffsetCents } from './music/pitch';
import { inScale, scaleById } from './music/scales';
import { SettingsStore, type Settings } from './state/settings';
import { Controls, button, el } from './ui/controls';
import { buildDashboard } from './ui/dashboard';
import { KeyboardView } from './ui/keyboard-view';

const store = new SettingsStore();
const engine = new AudioEngine();
const s0 = store.get();

const bellowsOf = (s: Settings) => ({ pressure: s.pressure, decay: s.bellowsDecay, airSeconds: s.airSeconds });
const metronomeOf = (s: Settings) => ({ bpm: s.bpm, beatsPerBar: s.beatsPerBar, accent: s.accent, volume: s.metronomeVolume });

const harmonium = new Harmonium(engine.ctx, `${import.meta.env.BASE_URL}packs/harmonium/manifest.json`, bellowsOf(s0));
harmonium.output.connect(engine.instrumentBus);
const metronome = new Metronome(engine.ctx, engine.clickBus, metronomeOf(s0));

const view = new KeyboardView();
const router = new NoteRouter(harmonium, {
  canPlay: (note) => {
    const s = store.get();
    if (note < KEYBOARD_LOW || note > KEYBOARD_HIGH) return false;
    return !s.scaleLock || inScale(note, s.sa, scaleById(s.scaleId));
  },
  onChange: (note, held) => view.setHeld(note, held),
});

// ── layout ─────────────────────────────────────────────────────────────
const app = document.getElementById('app')!;
const header = el('header', 'bar');
const wordmark = el('h1', 'wordmark', 'Harmonium');

const beatDot = el('span', 'beat-dot');
beatDot.setAttribute('aria-hidden', 'true');
const bpmOut = el('span', 'mono');
const metroBtn = button('', () => {
  gesture();
  metronome.toggle();
  syncMetro();
}, 'btn metro');
metroBtn.append(beatDot, bpmOut);
metroBtn.title = 'Start or stop the metronome (Space)';

const status = el('span', 'status mono');
status.setAttribute('aria-live', 'polite');
const settingsBtn = button('Settings', () => toggleSettings(), 'btn');
settingsBtn.title = 'Open or close settings (`)';
settingsBtn.setAttribute('aria-controls', 'dashboard');
header.append(wordmark, metroBtn, status, settingsBtn);

const controls = new Controls(store);
const taps: number[] = [];
const dashboard = buildDashboard(controls, {
  shiftOctave,
  tap: () => {
    taps.push(performance.now());
    if (taps.length > 8) taps.shift();
    const bpm = bpmFromTaps(taps);
    if (bpm) store.set({ bpm });
  },
  midi: midiSupported()
    ? () =>
        enableMidi(router, (names) => setStatusNote(names.length ? `MIDI: ${names.join(', ')}` : 'No MIDI device found')).catch(
          () => setStatusNote('MIDI access was blocked'),
        )
    : undefined,
  reset: () => store.reset(),
});

// Settings save on every change; say so, or say why they can't.
const saveNote = el('span', 'save-note');
const updateSaveNote = () => {
  saveNote.textContent = store.canSave ? 'Settings are saved in this browser' : 'This browser is blocking storage, so settings reset when you close it';
  saveNote.classList.toggle('warn', !store.canSave);
};
store.subscribe(updateSaveNote);
updateSaveNote();
dashboard.querySelector('.row:last-child')!.prepend(saveNote);

const bellowsStrip = el('div', 'bellows');
bellowsStrip.setAttribute('role', 'meter');
bellowsStrip.setAttribute('aria-label', 'Air in the bellows');
bellowsStrip.setAttribute('aria-valuemin', '0');
bellowsStrip.setAttribute('aria-valuemax', '100');

const stage = el('main', 'stage');
const hint = el('p', 'hint');
hint.innerHTML =
  'Play with <kbd>Z</kbd>…<kbd>/</kbd> and <kbd>Q</kbd>…<kbd>]</kbd> · <kbd>←</kbd><kbd>→</kbd> octave · <kbd>↑</kbd><kbd>↓</kbd> air · <kbd>Space</kbd> metronome · <kbd>`</kbd> settings';
stage.append(bellowsStrip, view.el, hint);
app.append(header, dashboard, stage);

let settingsOpen = false;
function toggleSettings(open = !settingsOpen): void {
  settingsOpen = open;
  dashboard.classList.toggle('open', open);
  settingsBtn.setAttribute('aria-expanded', String(open));
}
toggleSettings(false);

// ── behaviour ──────────────────────────────────────────────────────────
let started = false;
function gesture(): void {
  if (started && engine.ctx.state === 'running') return;
  started = true;
  engine.resume().then(updateStatus);
  // Ask the browser not to evict saved settings (and the offline cache) under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
  document.body.classList.add('started');
}

function shiftOctave(dir: -1 | 1): void {
  store.set({ windowBase: clampWindowBase(store.get().windowBase + dir * 12) });
}

function syncMetro(): void {
  metroBtn.classList.toggle('on', metronome.running);
  metroBtn.setAttribute('aria-pressed', String(metronome.running));
}

metronome.onBeat = (index) => {
  beatDot.classList.remove('tick', 'accent');
  void beatDot.offsetWidth; // restart the CSS animation
  beatDot.classList.add('tick');
  if (index === 0 && store.get().accent) beatDot.classList.add('accent');
};

harmonium.onPressure = (p) => {
  bellowsStrip.style.setProperty('--air', p.toFixed(3));
  bellowsStrip.setAttribute('aria-valuenow', String(Math.round(p * 100)));
};

attachKeyboard(router, {
  windowBase: () => store.get().windowBase,
  shiftOctave,
  nudgePressure: (dir) => store.set({ pressure: Math.min(1, Math.max(0, Math.round((store.get().pressure + dir * 0.1) * 10) / 10)) }),
  toggleSettings: (open) => {
    toggleSettings(open);
    // Move focus out of the panel when it closes, so keys play notes again.
    if (!settingsOpen && dashboard.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  },
  toggleMetronome: () => {
    metronome.toggle();
    syncMetro();
  },
  onGesture: gesture,
});
attachPointer(view.el, router, gesture);

function apply(s: Settings, changed: Partial<Settings>): void {
  const all = Object.keys(changed).length === 0;
  const has = (...keys: (keyof Settings)[]) => all || keys.some((k) => k in changed);

  if (has('volume')) engine.setVolume(s.volume);
  if (has('reverbMix', 'reverbSize')) engine.setReverb(s.reverbMix, s.reverbSize);
  if (has('transpose', 'a4Hz')) harmonium.setPitchCents(pitchOffsetCents(s.transpose, s.a4Hz));
  if (has('stopBass', 'stopMain', 'stopHigh')) {
    harmonium.setStop('bass', s.stopBass);
    harmonium.setStop('main', s.stopMain);
    harmonium.setStop('high', s.stopHigh);
  }
  if (has('pressure', 'bellowsDecay', 'airSeconds')) harmonium.setBellows(bellowsOf(s));
  if (has('reedAttack')) harmonium.setAttack(s.reedAttack);
  if (has('drone', 'dronePa', 'sa')) {
    const sa = 48 + s.sa; // Sa in the third octave, like a harmonium's drone stop
    harmonium.setDrone(s.drone ? (s.dronePa ? [sa, sa + 7] : [sa]) : []);
  }
  if (has('bpm', 'beatsPerBar', 'accent', 'metronomeVolume')) metronome.update(metronomeOf(s));
  if (has('bpm')) bpmOut.textContent = `${s.bpm}`;
  if (has('keyLabels')) {
    view.el.classList.toggle('hide-names', s.keyLabels === 'keys' || s.keyLabels === 'none');
    view.el.classList.toggle('hide-kbd', s.keyLabels === 'notes' || s.keyLabels === 'none');
  }
  if (has('windowBase', 'sa', 'scaleId', 'scaleLock', 'labelMode')) {
    view.render({ windowBase: s.windowBase, sa: s.sa, scale: scaleById(s.scaleId), scaleLock: s.scaleLock, labelMode: s.labelMode });
  }
}

store.subscribe(apply);
apply(store.get(), {});
controls.refresh();
syncMetro();

// ── status line ────────────────────────────────────────────────────────
let statusNote = '';
function setStatusNote(note: string): void {
  statusNote = note;
  updateStatus();
}
function updateStatus(): void {
  const parts: string[] = [];
  const lat = engine.latencyMs();
  if (!lat) parts.push('Press any key to start');
  else {
    parts.push(`${lat.total} ms`);
    if (lat.total > 100) parts.push('high latency: wired headphones help');
  }
  parts.push(harmonium.source === 'samples' ? 'sampled reeds' : 'synth reeds');
  if (statusNote) parts.push(statusNote);
  status.textContent = parts.join(' · ');
  status.classList.toggle('warn', !!lat && lat.total > 100);
}
harmonium.load().then(updateStatus);
setInterval(updateStatus, 2000);
updateStatus();

registerSW({ immediate: true });
