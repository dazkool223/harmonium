import type { Settings, SettingsStore } from '../state/settings';

type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type StrKey = { [K in keyof Settings]: Settings[K] extends string | number ? K : never }[keyof Settings];

/** Tiny bound-control helpers: each control reflects store changes from anywhere (e.g. hotkeys). */
export class Controls {
  private updaters: (() => void)[] = [];

  constructor(private store: SettingsStore) {
    store.subscribe(() => this.refresh());
  }

  refresh(): void {
    for (const u of this.updaters) u();
  }

  slider(key: NumKey, label: string, min: number, max: number, step: number, fmt: (v: number) => string): HTMLElement {
    const id = `c-${key}`;
    const row = el('label', 'ctl slider');
    row.htmlFor = id;
    const name = el('span', 'ctl-label', label);
    const out = el('output', 'ctl-value');
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', id, min: String(min), max: String(max), step: String(step) });
    input.addEventListener('input', () => this.store.set({ [key]: Number(input.value) } as Partial<Settings>));
    row.append(name, out, input);
    this.updaters.push(() => {
      const v = this.store.get()[key];
      if (document.activeElement !== input) input.value = String(v);
      out.textContent = fmt(v);
    });
    return row;
  }

  toggle(key: BoolKey, label: string): HTMLElement {
    const row = el('label', 'ctl toggle');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.addEventListener('change', () => this.store.set({ [key]: input.checked } as Partial<Settings>));
    row.append(input, el('span', 'ctl-label', label));
    this.updaters.push(() => (input.checked = this.store.get()[key]));
    return row;
  }

  select(key: StrKey, label: string, options: [value: string | number, text: string][]): HTMLElement {
    const row = el('label', 'ctl select');
    const sel = document.createElement('select');
    for (const [value, text] of options) sel.append(new Option(text, String(value)));
    const numeric = typeof this.store.get()[key] === 'number';
    sel.addEventListener('change', () =>
      this.store.set({ [key]: numeric ? Number(sel.value) : sel.value } as Partial<Settings>),
    );
    row.append(el('span', 'ctl-label', label), sel);
    this.updaters.push(() => (sel.value = String(this.store.get()[key])));
    return row;
  }

  /** Re-runs `fn` whenever settings change (for derived UI like disabled states). */
  watch(fn: (s: Readonly<Settings>) => void): void {
    this.updaters.push(() => fn(this.store.get()));
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function button(label: string, onClick: () => void, className = 'btn'): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
