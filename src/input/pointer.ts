import type { NoteRouter } from './router';

/**
 * Velocity from a pointer: real pressure only for pen/touch hardware that reports it.
 * Mice (and touch screens without sensors) report a constant 0.5 while pressed.
 */
export function pointerVelocity(e: Pick<PointerEvent, 'pointerType' | 'pressure'>): number {
  if (e.pointerType !== 'mouse' && e.pressure > 0 && e.pressure !== 0.5) {
    return Math.min(1, 0.3 + e.pressure * 0.9);
  }
  return 1;
}

function noteAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-note]');
  return el ? Number(el.dataset.note) : null;
}

/** On-screen keys: press, drag across keys (glissando), multi-touch chords. */
export function attachPointer(container: HTMLElement, router: NoteRouter, onGesture: () => void): void {
  const active = new Map<number, number>(); // pointerId → note

  const move = (e: PointerEvent, note: number | null) => {
    const prev = active.get(e.pointerId);
    if (prev === note) return;
    if (prev !== undefined) router.release(`ptr:${e.pointerId}`, prev);
    if (note === null) active.delete(e.pointerId);
    else {
      active.set(e.pointerId, note);
      router.press(`ptr:${e.pointerId}`, note, pointerVelocity(e));
    }
  };

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    onGesture();
    e.preventDefault();
    // Release implicit touch capture so dragging moves across keys.
    if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
    move(e, noteAt(e.clientX, e.clientY));
  });
  container.addEventListener('pointermove', (e) => {
    if (active.has(e.pointerId)) move(e, noteAt(e.clientX, e.clientY));
  });
  const end = (e: PointerEvent) => move(e, null);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  container.addEventListener('contextmenu', (e) => e.preventDefault());
}
