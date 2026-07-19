'use strict';

// ===========================================================================
// Text encoding detect / decode / encode using only Node built-ins (Buffer +
// TextDecoder) — no external dependency. Covers the encodings that actually
// show up in day-to-day editing:
//   'utf8' · 'utf8bom' · 'utf16le' · 'utf16be' · 'latin1'
// Pure + unit-tested (test/encoding.test.js). Used by main.js fs:read/fs:write.
// ===========================================================================

const LABELS = {
  utf8: 'UTF-8',
  utf8bom: 'UTF-8 BOM',
  utf16le: 'UTF-16 LE',
  utf16be: 'UTF-16 BE',
  latin1: 'Latin-1'
};

// Encodings offered in the "Reopen/Save with Encoding" picker.
const LIST = ['utf8', 'utf8bom', 'utf16le', 'utf16be', 'latin1'];

function label(enc) { return LABELS[enc] || 'UTF-8'; }

function hasUtf8Bom(buf) { return buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF; }
function hasUtf16leBom(buf) { return buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE; }
function hasUtf16beBom(buf) { return buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF; }

function isValidUtf8(buf) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; }
  catch { return false; }
}

// Best-effort encoding guess. BOM wins; otherwise a NUL-byte histogram spots
// UTF-16, then a strict UTF-8 check, falling back to Latin-1.
function detect(buf) {
  if (hasUtf8Bom(buf)) return 'utf8bom';
  if (hasUtf16leBom(buf)) return 'utf16le';
  if (hasUtf16beBom(buf)) return 'utf16be';
  const n = Math.min(buf.length, 4096);
  let evenZero = 0, oddZero = 0;
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) { if (i % 2 === 0) evenZero++; else oddZero++; }
  }
  // ASCII text as UTF-16LE has NUL in the odd (high) byte; UTF-16BE the even.
  if (oddZero > n * 0.2 && evenZero <= oddZero / 4) return 'utf16le';
  if (evenZero > n * 0.2 && oddZero <= evenZero / 4) return 'utf16be';
  if (isValidUtf8(buf.subarray(0, n))) return 'utf8';
  return 'latin1';
}

// Copy + byte-swap a buffer of 16-bit units (BE <-> LE).
function swap16(buf) {
  const out = Buffer.from(buf); // copy so the caller's data is untouched
  if (out.length % 2 === 1) return out; // odd length: leave as-is
  out.swap16();
  return out;
}

// Decode raw bytes → JS string for the given (or auto-detected) encoding.
function decode(buf, enc) {
  const e = enc || detect(buf);
  switch (e) {
    case 'utf8bom': return buf.subarray(hasUtf8Bom(buf) ? 3 : 0).toString('utf8');
    case 'utf16le': return buf.subarray(hasUtf16leBom(buf) ? 2 : 0).toString('utf16le');
    case 'utf16be': return swap16(buf.subarray(hasUtf16beBom(buf) ? 2 : 0)).toString('utf16le');
    case 'latin1': return buf.toString('latin1');
    case 'utf8':
    default: return buf.toString('utf8');
  }
}

// Encode a JS string → raw bytes for the given encoding (writing any BOM).
function encode(str, enc) {
  switch (enc) {
    case 'utf8bom': return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(str, 'utf8')]);
    case 'utf16le': return Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(str, 'utf16le')]);
    case 'utf16be': return Buffer.concat([Buffer.from([0xFE, 0xFF]), swap16(Buffer.from(str, 'utf16le'))]);
    case 'latin1': return Buffer.from(str, 'latin1');
    case 'utf8':
    default: return Buffer.from(str, 'utf8');
  }
}

module.exports = { detect, decode, encode, label, LABELS, LIST };
