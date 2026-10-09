import { KEYMAP } from './keymap';
import type { NoteRouter } from './router';

export interface KeyboardActions {
  windowBase(): number;
  shiftOctave(dir: -1 | 1): void;
  nudgePressure(dir: -1 | 1): void;
  toggleMetronome(): void;
  /** ` toggles the settings panel; Esc closes it. */
  toggleSettings(open?: boolean): void;
  /** First gesture: resume audio. */
  onGesture(): void;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !['range', 'checkbox', 'button'].includes(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
}

/** Computer keyboard → notes, by physical key position (event.code). */
export function attachKeyboard(router: NoteRouter, actions: KeyboardActions): void {
  // Remember which note each key started, so releasing after an octave shift stops the right note.
  const down = new Map<string, number>();

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Panel shortcuts work even while a settings control has focus.
    if (e.code === 'Backquote' || e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) actions.toggleSettings(e.code === 'Escape' ? false : undefined);
      return;
    }
    if (isTextField(e.target)) return;
    actions.onGesture();
    const offset = KEYMAP[e.code];
    if (offset !== undefined) {
      e.preventDefault();
      if (e.repeat || down.has(e.code)) return;
      const note = actions.windowBase() + offset;
      down.set(e.code, note);
      router.press(`key:${e.code}`, note, 1);
      return;
    }
    switch (e.code) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        // Leave arrows to focused sliders.
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        if (e.code === 'ArrowLeft') actions.shiftOctave(-1);
        if (e.code === 'ArrowRight') actions.shiftOctave(1);
        if (e.code === 'ArrowUp') actions.nudgePressure(1);
        if (e.code === 'ArrowDown') actions.nudgePressure(-1);
        return;
      case 'Space':
        e.preventDefault();
        if (!e.repeat) actions.toggleMetronome();
        return;
    }
  });

  window.addEventListener('keyup', (e) => {
    const note = down.get(e.code);
    if (note === undefined) return;
    down.delete(e.code);
    router.release(`key:${e.code}`, note);
  });

  // Keys released while the window is unfocused never fire keyup.
  const releaseAll = () => {
    for (const [code, note] of down) router.release(`key:${code}`, note);
    down.clear();
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
}
