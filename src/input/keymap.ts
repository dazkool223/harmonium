/**
 * 2-row tracker layout, by physical key (KeyboardEvent.code), as semitone offsets
 * from the Key window base. Lower row: Z-row whites, A-row blacks. Upper row:
 * Q-row whites (starting one octave up), digit-row blacks.
 */
export const KEYMAP: Readonly<Record<string, number>> = {
  // lower row
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7,
  KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14,
  Semicolon: 15, Slash: 16,
  // upper row
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18,
  KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25,
  KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31,
};

/** Printable label for a code, for on-screen hints. */
const LABELS: Readonly<Record<string, string>> = {
  Comma: ',', Period: '.', Semicolon: ';', Slash: '/', BracketLeft: '[',
  BracketRight: ']', Equal: '=',
};

export function codeLabel(code: string): string {
  if (LABELS[code]) return LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/**
 * Note → key labels for the current window. Where the rows overlap (offsets
 * 12..16) a note has two keys; the upper-row key comes first, matching the
 * physical keyboard, so each row reads as a whole Sa-to-Sa run (Z…, and Q…I).
 */
export function labelsForWindow(base: number): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [code, offset] of Object.entries(KEYMAP)) {
    const note = base + offset;
    const isUpper = code.startsWith('Digit') || /^Key[QWERTYUIOP]$/.test(code) || code.startsWith('Bracket') || code === 'Equal';
    const labels = out.get(note) ?? [];
    if (isUpper) labels.unshift(codeLabel(code));
    else labels.push(codeLabel(code));
    out.set(note, labels);
  }
  return out;
}

export const KEYBOARD_LOW = 36; // C2
export const KEYBOARD_HIGH = 77; // F5 — 42 keys
export const DEFAULT_WINDOW_BASE = 48; // C3, so Q = C4

/** Window bases are whole octaves; keep at least part of the window on the 42 keys. */
export function clampWindowBase(base: number): number {
  return Math.min(72, Math.max(24, base));
}
