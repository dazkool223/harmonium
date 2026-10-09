// Builds the harmonium sample pack from the CC0 Freesound #330410 recording.
// Usage: node scripts/build-harmonium-pack.mjs [--input file.wav] [--analyze]
// Pipeline: decode -> segment notes (RMS) -> YIN pitch -> pick samples ->
// trim + loop-point search + crossfade -> 16-bit WAV + manifest.json
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const OUT = join(ROOT, 'public', 'packs', 'harmonium');
const SR = 44100;
const URL_SRC = 'https://cdn.freesound.org/previews/330/330410_1089898-hq.ogg';
const FREESOUND = 'https://freesound.org/s/330410/';
const RANGE_LO = 36, RANGE_HI = 77, STEP = 3;

const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const ANALYZE_ONLY = args.includes('--analyze');

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const noteName = (m) => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// ---------- 1. input / decode ----------
async function getInput() {
  const local = argVal('--input');
  if (local) return resolve(local);
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, '330410_1089898-hq.ogg');
  if (!existsSync(f)) {
    console.log('Downloading', URL_SRC);
    const r = await fetch(URL_SRC);
    if (!r.ok) throw new Error('download failed: ' + r.status);
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return f;
}

function decode(file) {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'],
    { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
  const b = r.stdout;
  const out = new Float32Array(b.length >> 2);
  for (let i = 0; i < out.length; i++) out[i] = b.readFloatLE(i * 4);
  return out;
}

// ---------- 2. segmentation ----------
function segment(x) {
  const hop = Math.round(0.02 * SR);
  const n = Math.floor(x.length / hop);
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) s += x[i] * x[i];
    rms[f] = Math.sqrt(s / hop);
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(n * 0.98)];       // robust "peak" level
  const thr = ref * 0.1;                           // ~ -20 dB below
  const segs = [];
  let start = -1;
  for (let f = 0; f <= n; f++) {
    const on = f < n && rms[f] > thr;
    if (on && start < 0) start = f;
    if (!on && start >= 0) { segs.push([start, f]); start = -1; }
  }
  // merge gaps < 100 ms
  const merged = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s[0] - last[1] < 5) last[1] = s[1]; else merged.push([...s]);
  }
  return merged.filter(([a, b]) => (b - a) * 0.02 >= 0.5)
    .map(([a, b]) => ({ start: a * hop, end: b * hop }));
}

// ---------- 3. pitch (YIN) ----------
function yin(x, pos, W, tauMin, tauMax) {
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const df = x[pos + i] - x[pos + i + tau]; s += df * df; }
    d[tau] = s;
  }
  let run = 0;
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; cm[tau] = run > 0 ? d[tau] * tau / run : 1; }
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cm[t] < 0.12) { while (t + 1 < tauMax && cm[t + 1] < cm[t]) t++; tau = t; break; }
  }
  if (tau < 0) { // fallback: global minimum
    tau = tauMin; for (let t = tauMin; t < tauMax; t++) if (cm[t] < cm[tau]) tau = t;
  }
  const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? 0.5 * (a - c) / den : 0;
  return { period: tau + shift, conf: 1 - cm[tau] };
}

// Median period over several windows in the steady middle of [a,b)
function detectPitch(x, a, b, hintNote) {
  const len = b - a;
  const mid0 = a + Math.floor(len * 0.35), mid1 = a + Math.floor(len * 0.75);
  let tauMin = Math.floor(SR / midiToHz(88)), tauMax = Math.ceil(SR / midiToHz(30));
  if (hintNote !== undefined) {   // constrain search to +-1 semitone around the expected note
    tauMin = Math.floor(SR / midiToHz(hintNote + 1)); tauMax = Math.ceil(SR / midiToHz(hintNote - 1));
  }
  const W = 3072;
  const ps = [];
  const N = 7;
  for (let k = 0; k < N; k++) {
    const pos = Math.floor(mid0 + (mid1 - mid0 - W - tauMax) * k / (N - 1));
    if (pos < a || pos + W + tauMax >= b) continue;
    const r = yin(x, pos, W, tauMin, tauMax);
    if (r.conf > 0.7) ps.push(r.period);
  }
  if (!ps.length) return null;
  ps.sort((p, q) => p - q);
  const period = ps[Math.floor(ps.length / 2)];
  const midi = hzToMidi(SR / period);
  const note = Math.round(midi);
  return { period, hz: SR / period, midi, note, cents: (midi - note) * 100, spread: (ps[ps.length - 1] - ps[0]) / period };
}

// ---------- 5. loop search ----------
function upZeroCrossings(x, a, b) {
  const z = [];
  for (let i = Math.max(a, 1); i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) z.push(i);
  return z;
}

function findLoop(x, period, from, to, targetLen) {
  // x already starts at onset. Try start crossings in [from, from+0.3 s]; ends near start+k*period.
  const W = Math.round(period * 3);
  let best = null;
  const starts = upZeroCrossings(x, from, from + Math.round(0.3 * SR));
  const stride = Math.max(1, Math.floor(starts.length / 12));
  for (let si = 0; si < starts.length; si += stride) {
    const s = starts[si];
    const k = Math.max(1, Math.round(targetLen / period));
    const ideal = s + k * period;
    for (const e of upZeroCrossings(x, Math.round(ideal - period), Math.round(ideal + period))) {
      if (e + W > to || e - s < 0.5 * SR) continue;
      let err = 0, en = 1e-9;
      for (let i = -W; i < W; i++) {
        // after wrapping, sample e+i continues as s+i
        const d = x[e + i] - x[s + i];
        err += d * d; en += x[s + i] * x[s + i];
      }
      // penalise deviation from an integer number of periods
      const frac = (e - s) / period; const dev = Math.abs(frac - Math.round(frac));
      const score = err / en + dev * 2;
      if (!best || score < best.score) best = { s, e, score, periods: frac };
    }
  }
  return best;
}

// ---------- 6. WAV ----------
function wav16(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  return buf;
}

function readWav16(buf) {
  const n = buf.readUInt32LE(40) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return out;
}

// ---------- main ----------
const input = await getInput();
console.log('Decoding', input);
const x = decode(input);
console.log(`Decoded ${(x.length / SR).toFixed(1)} s`);

const segs = segment(x);
console.log(`\n#   start(s)  dur(s)  pitch(Hz)  note  cents  spread  flag`);
let prev = null;
for (const [i, s] of segs.entries()) {
  const dur = (s.end - s.start) / SR;
  s.drone = dur > 15;   // drones are the long (>15 s) segments at the end
  s.p = detectPitch(x, s.start, s.end);
  let flag = '';
  if (s.drone) flag = 'drone';
  else if (!s.p) flag = 'no-pitch';
  else {
    // Keys are played in ascending semitones: fix octave errors / unstable YIN using the expected note.
    const expected = prev === null ? null : prev + 1;
    if (expected !== null && (s.p.note !== expected || s.p.spread > 0.02)) {
      const was = s.p.note, wasSpread = s.p.spread;
      const fixed = detectPitch(x, s.start, s.end, expected);
      if (fixed && fixed.note === expected && fixed.spread <= 0.02) {
        s.p = fixed;
        flag = `fixed (was ${noteName(was)}${wasSpread > 0.02 ? ', unstable' : ''})`;
      } else flag = `step ${s.p.note - prev >= 0 ? '+' : ''}${s.p.note - prev}`;
    }
    if (s.p.spread > 0.02) flag += ' unstable';
    prev = s.p.note;
  }
  console.log(`${String(i).padStart(2)}  ${(s.start / SR).toFixed(2).padStart(8)}  ${dur.toFixed(2).padStart(6)}  ` +
    `${s.p ? s.p.hz.toFixed(1).padStart(9) : '        -'}  ${s.p ? (noteName(s.p.note) + '(' + s.p.note + ')').padEnd(7) : '-'.padEnd(7)}` +
    `${s.p ? s.p.cents.toFixed(0).padStart(5) : '    -'}  ${s.p ? s.p.spread.toFixed(3) : '-'}  ${flag}`);
}
if (ANALYZE_ONLY) process.exit(0);

// Candidates: clean single notes (stable pitch, decent length); keep first occurrence per note.
const cands = new Map();
for (const s of segs) {
  if (s.drone || !s.p || s.p.spread > 0.02 || (s.end - s.start) / SR < 2.0) continue;
  if (s.p.note < 24 || s.p.note > 96) continue;
  if (!cands.has(s.p.note)) cands.set(s.p.note, s);
}
const avail = [...cands.keys()].sort((a, b) => a - b);
console.log('\nUsable notes:', avail.map(noteName).join(' '));
if (!avail.length) throw new Error('no usable notes detected');

// ---------- 4. choose roughly every STEP semitones ----------
const chosen = [];
const lo = avail[0], hi = avail[avail.length - 1];
for (let t = lo; t <= hi; t += STEP) {
  const n = avail.reduce((b, c) => (Math.abs(c - t) < Math.abs(b - t) ? c : b));
  if (!chosen.includes(n)) chosen.push(n);
}
if (!chosen.includes(hi) && hi - chosen[chosen.length - 1] >= 2) chosen.push(hi);
chosen.sort((a, b) => a - b);

// ---------- 5. render each sample ----------
const rendered = [];
for (const note of chosen) {
  const s = cands.get(note);
  // refine onset: first sample above 8% of the segment's early peak
  let pk = 0;
  for (let i = s.start; i < Math.min(s.end, s.start + SR); i++) pk = Math.max(pk, Math.abs(x[i]));
  let on = s.start;
  while (on < s.end && Math.abs(x[on]) < pk * 0.08) on++;
  const a = Math.max(0, on - Math.round(0.005 * SR));
  const maxLen = Math.min(s.end - a, Math.round(3 * SR));
  const seg = Float32Array.from(x.subarray(a, a + maxLen));
  let dc = 0; for (const v of seg) dc += v; dc /= seg.length;   // remove DC
  for (let i = 0; i < seg.length; i++) seg[i] -= dc;

  const period = s.p.period;
  const loop = findLoop(seg, period, Math.round(0.6 * SR), seg.length, 1.1 * SR);
  if (!loop) { console.warn('no loop for', note); continue; }
  // crossfade: blend material before loopStart into the tail before loopEnd
  const xf = Math.min(Math.round(0.06 * SR), loop.s - 1);
  for (let i = 0; i < xf; i++) {
    const g = (i + 1) / xf;
    seg[loop.e - xf + i] = seg[loop.e - xf + i] * (1 - g) + seg[loop.s - xf + i] * g;
  }
  // after-loop tail: 50 ms then fade out
  const tail = Math.round(0.05 * SR);
  const outLen = Math.min(seg.length, loop.e + tail);
  const out = seg.slice(0, outLen);
  for (let i = 0; i < tail && loop.e + i < outLen; i++) out[loop.e + i] *= 0.5 * (1 + Math.cos(Math.PI * i / tail));
  const fi = Math.round(0.004 * SR);   // tiny fade-in over the lead-in
  for (let i = 0; i < fi; i++) out[i] *= i / fi;
  rendered.push({ note, out, loop, p: s.p });
}

// Common gain: loudest sample peaks at -3 dBFS; each is pulled halfway (in dB) toward the median RMS.
const rmsOf = (o) => { let s = 0; for (const v of o) s += v * v; return Math.sqrt(s / o.length); };
const rmss = rendered.map((r) => rmsOf(r.out));
const medRms = [...rmss].sort((a, b) => a - b)[Math.floor(rmss.length / 2)];
const gains = rendered.map((r, i) => (medRms / rmss[i]) ** 0.5);
let maxPeak = 0;
rendered.forEach((r, i) => { let p = 0; for (const v of r.out) p = Math.max(p, Math.abs(v)); maxPeak = Math.max(maxPeak, p * gains[i]); });
const master = 10 ** (-3 / 20) / maxPeak;

// ---------- 6. write ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const samples = [];
rendered.forEach((r, i) => {
  const g = gains[i] * master;
  for (let k = 0; k < r.out.length; k++) r.out[k] *= g;
  const name = `h-${String(r.note).padStart(3, '0')}.wav`;
  writeFileSync(join(OUT, name), wav16(r.out));
  const prevN = i > 0 ? rendered[i - 1].note : null, nextN = i < rendered.length - 1 ? rendered[i + 1].note : null;
  const loNote = prevN === null ? RANGE_LO : Math.floor((prevN + r.note) / 2) + 1;
  const hiNote = nextN === null ? RANGE_HI : Math.floor((r.note + nextN) / 2);
  samples.push({
    url: name, rootNote: r.note, loNote, hiNote,
    loopStart: +(r.loop.s / SR).toFixed(5), loopEnd: +(r.loop.e / SR).toFixed(5),
    tune: Math.round(-r.p.cents),
  });
});
const manifest = {
  name: 'Harmonium (donyaquick, CC0)', license: 'CC0-1.0', source: FREESOUND,
  envelope: { attack: 0.05, release: 0.12 }, samples,
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---------- 7. verify ----------
console.log('\nSample       root  range    loop(s)           periods  tune  gain(dB)  dur');
let total = 0;
samples.forEach((s, i) => {
  const buf = readFileSync(join(OUT, s.url)); total += buf.length;
  const d = readWav16(buf);
  const dur = d.length / SR;
  if (!(s.loopStart > 0 && s.loopEnd <= dur && s.loopEnd - s.loopStart >= 0.5)) throw new Error('bad loop ' + s.url);
  console.log(`${s.url}  ${noteName(s.rootNote).padEnd(4)} ${String(s.loNote).padStart(3)}-${String(s.hiNote).padEnd(3)}  ` +
    `${s.loopStart.toFixed(3)}-${s.loopEnd.toFixed(3)}  ${rendered[i].loop.periods.toFixed(2).padStart(9)}  ${String(s.tune).padStart(4)}  ` +
    `${(20 * Math.log10(gains[i] * master)).toFixed(1).padStart(7)}  ${dur.toFixed(2)}`);
});
console.log(`\nWrote ${samples.length} samples, ${(total / 1e6).toFixed(2)} MB to ${OUT}`);
