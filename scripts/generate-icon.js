'use strict';
// Generates build/icons/<size>.png app icons with zero dependencies.
//
// Brand: "Lumen" — luminance / clarity. The mark is a geometric "L" monogram cut
// from a luminous cyan→blue gradient, lit by a soft radial glow and a bright spark
// at the top of the stem (the "light source"). Deep indigo squircle tile.
// Rendered with 4x supersampling for anti-aliased edges at every size.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- color helpers ---------------------------------------------------------
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// Palette
const BG_TOP = hex('#26324e');   // indigo (top)
const BG_BOT = hex('#0d1322');   // deep navy (bottom)
const MK_A   = hex('#7df9ff');   // bright cyan (mark, lit side)
const MK_B   = hex('#3b82f6');   // blue (mark, shadow side)
const GLOW   = hex('#22d3ee');   // ambient cyan glow
const SPARK  = hex('#d6feff');   // spark core
const SPARK_H = hex('#67e8f9');  // spark halo

// ---- geometry (normalized 0..1) --------------------------------------------
const BG_R = 0.225;                       // squircle corner radius
const STEM = { x0: 0.365, w: 0.105, y0: 0.285, h: 0.440 };
const FOOT = { x0: 0.365, w: 0.300, y0: 0.6195, h: 0.105 };
const SPARK_C = { x: 0.4175, y: 0.262, r: 0.050 };
const GLOW_C = { x: 0.47, y: 0.45, r: 0.52, a: 0.17 };

function inRounded(px, py, x0, y0, w, h, r) {
  const x1 = x0 + w, y1 = y0 + h;
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  let cx, cy;
  if (px < x0 + r && py < y0 + r) { cx = x0 + r; cy = y0 + r; }
  else if (px > x1 - r && py < y0 + r) { cx = x1 - r; cy = y0 + r; }
  else if (px < x0 + r && py > y1 - r) { cx = x0 + r; cy = y1 - r; }
  else if (px > x1 - r && py > y1 - r) { cx = x1 - r; cy = y1 - r; }
  else return true;
  return Math.hypot(px - cx, py - cy) <= r;
}

// Render at supersampled resolution N, return RGBA buffer.
function renderHi(N) {
  const px = Buffer.alloc(N * N * 4); // starts fully transparent
  function blend(i, col, a) {
    const inv = 1 - a;
    px[i]     = Math.round(col[0] * a + px[i] * inv);
    px[i + 1] = Math.round(col[1] * a + px[i + 1] * inv);
    px[i + 2] = Math.round(col[2] * a + px[i + 2] * inv);
    px[i + 3] = Math.round(255 * a + px[i + 3] * inv);
  }
  for (let y = 0; y < N; y++) {
    const ny = y / N;
    for (let x = 0; x < N; x++) {
      const nx = x / N;
      const i = (y * N + x) * 4;

      // 1) squircle tile (rounded silhouette) with vertical gradient
      if (!inRounded(nx, ny, 0, 0, 1, 1, BG_R)) continue; // outside → transparent
      const bg = mix(BG_TOP, BG_BOT, Math.pow(ny, 1.05));
      px[i] = bg[0]; px[i + 1] = bg[1]; px[i + 2] = bg[2]; px[i + 3] = 255;

      // 2) ambient radial glow
      const dg = Math.hypot(nx - GLOW_C.x, ny - GLOW_C.y) / GLOW_C.r;
      if (dg < 1) blend(i, GLOW, GLOW_C.a * (1 - dg) * (1 - dg));

      // 3) the "L" mark (stem + foot), luminous diagonal gradient
      const inStem = inRounded(nx, ny, STEM.x0, STEM.y0, STEM.w, STEM.h, STEM.w / 2);
      const inFoot = inRounded(nx, ny, FOOT.x0, FOOT.y0, FOOT.w, FOOT.h, FOOT.h / 2);
      if (inStem || inFoot) {
        const t = ((nx - 0.36) + (ny - 0.28)) / 0.55;
        blend(i, mix(MK_A, MK_B, t), 1);
      }

      // 4) spark halo + core (the light source)
      const ds = Math.hypot(nx - SPARK_C.x, ny - SPARK_C.y);
      if (ds < SPARK_C.r * 3.0) blend(i, SPARK_H, 0.55 * Math.max(0, 1 - ds / (SPARK_C.r * 3.0)));
      if (ds < SPARK_C.r)       blend(i, SPARK, 1);
    }
  }
  return px;
}

// Box-downsample supersampled buffer (N=S*ss) to S.
function downsample(hi, N, S, ss) {
  const out = Buffer.alloc(S * S * 4);
  const n = ss * ss;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const j = ((y * ss + dy) * N + (x * ss + dx)) * 4;
          r += hi[j]; g += hi[j + 1]; b += hi[j + 2]; a += hi[j + 3];
        }
      }
      const o = (y * S + x) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

function render(S) {
  const ss = 4;
  return downsample(renderHi(S * ss), S * ss, S, ss);
}

// ---- PNG encoder (zero deps) ----------------------------------------------
function toPNG(px, S) {
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const buildDir = path.join(__dirname, '..', 'build');
const outDir = path.join(buildDir, 'icons');
fs.mkdirSync(outDir, { recursive: true });
let icon512 = null;
for (const S of [512, 256, 128, 64, 48, 32, 16]) {
  const png = toPNG(render(S), S);
  if (S === 512) icon512 = png;
  fs.writeFileSync(path.join(outDir, `${S}x${S}.png`), png);
}
// electron-builder's default app icon (build/icon.png must be 512x512).
fs.writeFileSync(path.join(buildDir, 'icon.png'), icon512);
console.log('Lumen icons written to', outDir, '+ build/icon.png');
