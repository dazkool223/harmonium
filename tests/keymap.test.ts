import { describe, expect, it } from 'vitest';
import { KEYMAP, codeLabel, labelsForWindow, clampWindowBase } from '../src/input/keymap';

describe('keymap', () => {
  it('lower row is a chromatic run from Z', () => {
    const lower = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash'];
    lower.forEach((code, i) => expect(KEYMAP[code]).toBe(i));
  });
  it('upper row is a chromatic run from Q, an octave up', () => {
    const upper = ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP', 'BracketLeft', 'Equal', 'BracketRight'];
    upper.forEach((code, i) => expect(KEYMAP[code]).toBe(12 + i));
  });
  it('labels keys, listing both keys (upper row first) where the rows overlap', () => {
    expect(codeLabel('KeyQ')).toBe('Q');
    expect(codeLabel('Digit2')).toBe('2');
    expect(codeLabel('Comma')).toBe(',');
    const labels = labelsForWindow(48);
    expect(labels.get(48)).toEqual(['Z']); // lower Sa
    expect(labels.get(60)).toEqual(['Q', ',']); // upper Sa of the lower row, Sa of the upper row
    expect(labels.get(61)).toEqual(['2', 'L']);
    expect(labels.get(64)).toEqual(['E', '/']);
    expect(labels.get(72)).toEqual(['I']);
    expect(labels.get(79)).toEqual([']']);
  });
  it('clamps window base', () => {
    expect(clampWindowBase(0)).toBe(24);
    expect(clampWindowBase(120)).toBe(72);
  });
});
