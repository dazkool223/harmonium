/** Pitch classes relative to Sa (0..11). */
export interface Scale {
  id: string;
  name: string;
  degrees: readonly number[];
}

export const SCALES: readonly Scale[] = [
  { id: 'chromatic', name: 'Chromatic (all)', degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'bilawal', name: 'Bilawal / Major', degrees: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'kalyan', name: 'Kalyan (Yaman)', degrees: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'khamaj', name: 'Khamaj', degrees: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'kafi', name: 'Kafi', degrees: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'asavari', name: 'Asavari / Natural minor', degrees: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'bhairavi', name: 'Bhairavi', degrees: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'bhairav', name: 'Bhairav', degrees: [0, 1, 4, 5, 7, 8, 11] },
  { id: 'purvi', name: 'Purvi', degrees: [0, 1, 4, 6, 7, 8, 11] },
  { id: 'marwa', name: 'Marwa', degrees: [0, 1, 4, 6, 7, 9, 11] },
  { id: 'todi', name: 'Todi', degrees: [0, 1, 3, 6, 7, 8, 11] },
  { id: 'harmonic-minor', name: 'Harmonic minor', degrees: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'major-pentatonic', name: 'Major pentatonic (Bhupali)', degrees: [0, 2, 4, 7, 9] },
  { id: 'minor-pentatonic', name: 'Minor pentatonic (Malkauns-like)', degrees: [0, 3, 5, 8, 10] },
];

export function scaleById(id: string): Scale {
  return SCALES.find((s) => s.id === id) ?? SCALES[0];
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** `sa` is a pitch class 0..11 (0 = C). */
export function inScale(note: number, sa: number, scale: Scale): boolean {
  return scale.degrees.includes(mod12(note - sa));
}

const SARGAM = ['Sa', 're', 'Re', 'ga', 'Ga', 'Ma', 'ma', 'Pa', 'dha', 'Dha', 'ni', 'Ni'];
const WESTERN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export type LabelMode = 'sargam' | 'western';

export function noteLabel(note: number, sa: number, mode: LabelMode): string {
  return mode === 'sargam' ? SARGAM[mod12(note - sa)] : WESTERN[mod12(note)];
}

export function pitchClassName(pc: number): string {
  return WESTERN[mod12(pc)];
}

export function isBlackKey(note: number): boolean {
  return [1, 3, 6, 8, 10].includes(mod12(note));
}
