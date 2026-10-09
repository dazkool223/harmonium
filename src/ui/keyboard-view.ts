import { KEYBOARD_HIGH, KEYBOARD_LOW, labelsForWindow } from '../input/keymap';
import { inScale, isBlackKey, noteLabel, type LabelMode, type Scale } from '../music/scales';

export interface KeyboardViewState {
  windowBase: number;
  sa: number;
  scale: Scale;
  scaleLock: boolean;
  labelMode: LabelMode;
}

/** The 42-key on-screen keyboard. Pure view: input is handled by pointer.ts. */
export class KeyboardView {
  readonly el: HTMLElement;
  private keys = new Map<number, HTMLElement>();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'keys';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Harmonium keys');
    let white = 0;
    const whiteCount = [...range(KEYBOARD_LOW, KEYBOARD_HIGH)].filter((n) => !isBlackKey(n)).length;
    this.el.style.setProperty('--whites', String(whiteCount));
    for (const note of range(KEYBOARD_LOW, KEYBOARD_HIGH)) {
      const key = document.createElement('div');
      const black = isBlackKey(note);
      key.className = black ? 'key black' : 'key white';
      key.dataset.note = String(note);
      if (black) key.style.setProperty('--at', String(white)); // sits on the boundary after `white` whites
      else white++;
      key.innerHTML = '<span class="dot"></span><span class="name"></span><kbd></kbd>';
      this.el.append(key);
      this.keys.set(note, key);
    }
  }

  render(s: KeyboardViewState): void {
    const letters = labelsForWindow(s.windowBase);
    for (const [note, key] of this.keys) {
      const scaled = inScale(note, s.sa, s.scale);
      const all = s.scale.degrees.length === 12;
      key.classList.toggle('in-scale', scaled && !all);
      key.classList.toggle('locked', s.scaleLock && !scaled);
      key.classList.toggle('sa', (((note - s.sa) % 12) + 12) % 12 === 0);
      key.classList.toggle('in-window', letters.has(note));
      key.querySelector('.name')!.textContent = noteLabel(note, s.sa, s.labelMode);
      key.querySelector('kbd')!.innerHTML = (letters.get(note) ?? []).map((l) => `<span>${l}</span>`).join('');
    }
  }

  setHeld(note: number, held: boolean): void {
    this.keys.get(note)?.classList.toggle('held', held);
  }
}

function* range(lo: number, hi: number): Generator<number> {
  for (let n = lo; n <= hi; n++) yield n;
}
