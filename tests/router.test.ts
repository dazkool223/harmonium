import { describe, expect, it } from 'vitest';
import { NoteRouter } from '../src/input/router';
import type { Instrument } from '../src/instruments/types';

function fake() {
  const log: string[] = [];
  const inst: Instrument = {
    name: 'fake',
    output: {} as AudioNode,
    load: async () => {},
    noteOn: (n, v) => void log.push(`on ${n} ${v}`),
    noteOff: (n) => void log.push(`off ${n}`),
    allNotesOff: () => {},
  };
  return { inst, log };
}

describe('NoteRouter', () => {
  it('sounds a note once while multiple sources hold it', () => {
    const { inst, log } = fake();
    const r = new NoteRouter(inst, { canPlay: () => true });
    r.press('key:KeyQ', 60, 1);
    r.press('ptr:1', 60, 0.5);
    r.release('key:KeyQ', 60);
    expect(log).toEqual(['on 60 1']);
    r.release('ptr:1', 60);
    expect(log).toEqual(['on 60 1', 'off 60']);
  });
  it('ignores repeated presses and unknown releases', () => {
    const { inst, log } = fake();
    const r = new NoteRouter(inst, { canPlay: () => true });
    r.press('a', 60, 1);
    r.press('a', 60, 1);
    r.release('b', 60);
    expect(log).toEqual(['on 60 1']);
  });
  it('blocks notes canPlay rejects (scale lock / range)', () => {
    const { inst, log } = fake();
    const r = new NoteRouter(inst, { canPlay: (n) => n % 2 === 0 });
    r.press('a', 61, 1);
    r.release('a', 61);
    expect(log).toEqual([]);
  });
  it('releaseAll stops everything and reports it', () => {
    const { inst, log } = fake();
    const changes: string[] = [];
    const r = new NoteRouter(inst, { canPlay: () => true, onChange: (n, h) => void changes.push(`${n}${h ? '+' : '-'}`) });
    r.press('a', 60, 1);
    r.press('b', 64, 1);
    r.releaseAll();
    expect(log).toEqual(['on 60 1', 'on 64 1', 'off 60', 'off 64']);
    expect(changes).toEqual(['60+', '64+', '60-', '64-']);
    expect(r.isHeld(60)).toBe(false);
  });
});
