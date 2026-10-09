import { describe, expect, it } from 'vitest';
import { SettingsStore, DEFAULTS } from '../src/state/settings';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('settings', () => {
  it('round-trips through storage', () => {
    const storage = memory();
    const a = new SettingsStore(storage);
    a.set({ bpm: 120, scaleId: 'kafi' });
    expect(a.canSave).toBe(true);
    // No flush or delay: a new store (the app reopened) sees the change right away.
    const b = new SettingsStore(storage);
    expect(b.get().bpm).toBe(120);
    expect(b.get().scaleId).toBe('kafi');
  });
  it('works with no storage', () => {
    const a = new SettingsStore(null);
    a.set({ bpm: 100 });
    expect(a.get().bpm).toBe(100);
    expect(a.canSave).toBe(false);
  });
  it('survives throwing storage and corrupt data', () => {
    const throwing = {
      getItem: (): string | null => { throw new Error('blocked'); },
      setItem: () => { throw new Error('full'); },
    };
    expect(new SettingsStore(throwing).get()).toEqual(DEFAULTS);
    const truncated = { getItem: () => '{"bpm":"fast","volume":0.3', setItem: () => {} };
    expect(new SettingsStore(truncated).get()).toEqual(DEFAULTS);
    const wrongType = { getItem: () => '{"bpm":"fast","volume":0.3}', setItem: () => {} };
    expect(new SettingsStore(wrongType).get().bpm).toBe(DEFAULTS.bpm);
    expect(new SettingsStore(wrongType).get().volume).toBe(0.3);
  });
  it('notifies subscribers with the patch', () => {
    const a = new SettingsStore(null);
    let seen: unknown;
    a.subscribe((_, changed) => (seen = changed));
    a.set({ transpose: 2 });
    expect(seen).toEqual({ transpose: 2 });
  });
});
