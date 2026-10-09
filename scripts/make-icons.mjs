// Draws the app icon (bellows pleats over keys) as SVG + PNGs. No deps: PNG via zlib.
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const INK = [0x1b, 0x1f, 0x2e];
const BRASS = [0xc9, 0xa2, 0x4a];
const EBONY = [0x2b, 0x22, 0x20];
const IVORY = [0xeb, 0xe5, 0xd6];

/** Colour at (u, v) in 0..1 icon space; keeps a safe margin for maskable icons. */
function colorAt(u, v) {
  const inX = u > 0.16 && u < 0.84;
  if (inX && v > 0.24 && v < 0.42) return Math.floor((u - 0.16) / 0.0425) % 2 ? EBONY : BRASS; // pleats
  if (inX && v > 0.46 && v < 0.78) {
    const k = (u - 0.16) / (0.68 / 5); // 5 white keys
    const frac = k - Math.floor(k);
    const black = v < 0.64 && Math.floor(k) < 4 && frac > 0.7 && Math.floor(k) !== 2;
    const prevBlack = v < 0.64 && Math.floor(k) > 0 && frac < 0.3 && Math.floor(k) !== 3;
    if (black || prevBlack) return EBONY;
    return frac < 0.04 ? EBONY : IVORY;
  }
  return INK;
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = colorAt((x + 0.5) / size, (y + 0.5) / size);
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));

const pleats = Array.from({ length: 16 }, (_, i) =>
  i % 2 ? '' : `<rect x="${16 + i * 4.25}" y="24" width="4.25" height="18" fill="#c9a24a"/>`,
).join('');
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#1b1f2e"/>
<rect x="16" y="24" width="68" height="18" fill="#2b2220"/>${pleats}
<rect x="16" y="46" width="68" height="32" rx="2" fill="#ebe5d6"/>
<path d="M29.6 46v32M43.2 46v32M56.8 46v32M70.4 46v32" stroke="#2b2220" stroke-width="0.8"/>
<rect x="25.5" y="46" width="8" height="18" fill="#2b2220"/><rect x="39.1" y="46" width="8" height="18" fill="#2b2220"/>
<rect x="66.3" y="46" width="8" height="18" fill="#2b2220"/>
</svg>
`,
);
console.log('icons written to public/');
