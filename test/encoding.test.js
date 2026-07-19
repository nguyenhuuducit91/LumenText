'use strict';

const test = require('node:test');
const assert = require('node:assert');
const enc = require('../src/main/encoding.js');

test('detect: UTF-8 BOM', () => {
  const b = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('hi', 'utf8')]);
  assert.strictEqual(enc.detect(b), 'utf8bom');
});

test('detect: UTF-16 LE BOM', () => {
  const b = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('hi', 'utf16le')]);
  assert.strictEqual(enc.detect(b), 'utf16le');
});

test('detect: UTF-16 BE BOM', () => {
  const le = Buffer.from('hi', 'utf16le'); le.swap16();
  const b = Buffer.concat([Buffer.from([0xFE, 0xFF]), le]);
  assert.strictEqual(enc.detect(b), 'utf16be');
});

test('detect: plain ASCII → utf8', () => {
  assert.strictEqual(enc.detect(Buffer.from('const x = 1;\n', 'utf8')), 'utf8');
});

test('detect: BOM-less UTF-16LE ASCII via NUL histogram', () => {
  assert.strictEqual(enc.detect(Buffer.from('hello world', 'utf16le')), 'utf16le');
});

test('detect: high-byte non-UTF-8 → latin1', () => {
  // 0xE9 alone ("é" in Latin-1) is invalid UTF-8
  assert.strictEqual(enc.detect(Buffer.from([0x63, 0x61, 0x66, 0xE9])), 'latin1');
});

for (const e of ['utf8', 'utf8bom', 'utf16le', 'utf16be', 'latin1']) {
  test('roundtrip encode→decode preserves text (' + e + ')', () => {
    const s = e === 'latin1' ? 'café rue' : 'héllo → wörld 🚀'.normalize();
    const text = e === 'latin1' ? 'café' : 'héllo → wörld';
    const bytes = enc.encode(text, e);
    assert.strictEqual(enc.decode(bytes, e), text);
    // auto-detect should also recover BOM'd forms
    if (e !== 'utf8' && e !== 'latin1') assert.strictEqual(enc.decode(bytes), text);
    void s;
  });
}

test('encode UTF-8 BOM writes the BOM bytes', () => {
  const b = enc.encode('x', 'utf8bom');
  assert.deepStrictEqual([b[0], b[1], b[2]], [0xEF, 0xBB, 0xBF]);
});

test('label maps to human names', () => {
  assert.strictEqual(enc.label('utf16be'), 'UTF-16 BE');
  assert.strictEqual(enc.label('utf8'), 'UTF-8');
});
