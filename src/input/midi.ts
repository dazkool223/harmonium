import type { NoteRouter } from './router';

export function midiSupported(): boolean {
  return typeof navigator.requestMIDIAccess === 'function';
}

/** Web MIDI input (Chromium; Safari won't support it). Call from a user gesture. */
export async function enableMidi(router: NoteRouter, onDevices: (names: string[]) => void): Promise<void> {
  const access = await navigator.requestMIDIAccess();
  const bind = () => {
    const names: string[] = [];
    access.inputs.forEach((input) => {
      names.push(input.name ?? 'MIDI input');
      input.onmidimessage = (msg) => {
        const data = msg.data;
        if (!data || data.length < 3) return;
        const [status, note, vel] = data;
        const type = status & 0xf0;
        const holder = `midi:${input.id}`;
        if (type === 0x90 && vel > 0) router.press(holder, note, vel / 127);
        else if (type === 0x80 || (type === 0x90 && vel === 0)) router.release(holder, note);
        else if (type === 0xb0 && (note === 120 || note === 123)) router.releaseAll(); // all sound/notes off
      };
    });
    onDevices(names);
  };
  access.onstatechange = bind;
  bind();
}
