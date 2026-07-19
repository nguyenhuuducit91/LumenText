'use strict';

// QA — huge file / 100000 lines / CRLF / LF / UTF-8 / emoji, via the streaming
// large-file engine (src/main/largefile.js). Builds real temp files, indexes
// them, and reads random screenfuls to verify content integrity.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lf = require('../src/main/largefile.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-qa-'));
const files = [];
function write(name, buf) { const p = path.join(TMP, name); fs.writeFileSync(p, buf); files.push(p); return p; }
test.after(() => { for (const p of files) { try { fs.unlinkSync(p); } catch {} } try { fs.rmdirSync(TMP); } catch {} });

async function openIndexed(p) {
  const s = lf.open(p);
  await s.buildIndex(null);
  return s;
}

// ---- 100000-line UTF-8 file (LF) ------------------------------------------
const N = 100000;
const line = (i) => `line-${i} café ${i % 7 === 0 ? '🚀' : 'x'}`;
const bigLF = write('big-lf.txt', Buffer.from(Array.from({ length: N }, (_, i) => line(i)).join('\n') + '\n', 'utf8'));

test('100000-line file: indexes to the correct line count', async () => {
  const s = await openIndexed(bigLF);
  assert.strictEqual(s.lineCount, N);
  lf.close(s.id);
});

test('100000-line file: reads correct content at many offsets', async () => {
  const s = await openIndexed(bigLF);
  for (const start of [0, 1, 4095, 4096, 4097, 8192, 50000, 99998, 99999]) {
    const got = s.readLines(start, 3);
    assert.strictEqual(got[0], line(start), `line ${start}`);
    if (start + 1 < N) assert.strictEqual(got[1], line(start + 1), `line ${start + 1}`);
  }
  lf.close(s.id);
});

test('100000-line file: every checkpoint boundary reads exactly', async () => {
  const s = await openIndexed(bigLF);
  const CE = lf.CHECKPOINT_EVERY;
  for (let cp = 0; cp < N; cp += CE) {
    assert.strictEqual(s.readLines(cp, 1)[0], line(cp), `checkpoint line ${cp}`);
  }
  lf.close(s.id);
});

test('100000-line file: emoji/unicode lines survive intact', async () => {
  const s = await openIndexed(bigLF);
  const idx = 70000; // 70000 % 7 === 0 → has 🚀
  assert.ok(s.readLines(idx, 1)[0].includes('🚀'));
  assert.ok(s.readLines(idx, 1)[0].includes('café'));
  lf.close(s.id);
});

// ---- CRLF file -------------------------------------------------------------
const crlf = write('crlf.txt', Buffer.from(Array.from({ length: 5000 }, (_, i) => 'row' + i).join('\r\n') + '\r\n', 'utf8'));
test('CRLF file: correct line count (splits on LF)', async () => {
  const s = await openIndexed(crlf);
  assert.strictEqual(s.lineCount, 5000);
  lf.close(s.id);
});
test('CRLF file: each line carries its trailing CR (raw bytes)', async () => {
  const s = await openIndexed(crlf);
  const l = s.readLines(10, 1)[0];
  assert.ok(l.startsWith('row10'));
  assert.ok(l.endsWith('\r'), 'CRLF line keeps the CR when split on LF');
  lf.close(s.id);
});

// ---- LF, no trailing newline ----------------------------------------------
const noNL = write('no-nl.txt', Buffer.from('alpha\nbeta\ngamma', 'utf8'));
test('LF no trailing newline: counts the final partial line', async () => {
  const s = await openIndexed(noNL);
  assert.strictEqual(s.lineCount, 3);
  assert.deepStrictEqual(s.readLines(0, 3), ['alpha', 'beta', 'gamma']);
  lf.close(s.id);
});

// ---- empty file ------------------------------------------------------------
const empty = write('empty.txt', Buffer.alloc(0));
test('empty file: zero lines, empty read', async () => {
  const s = await openIndexed(empty);
  assert.strictEqual(s.lineCount, 0);
  assert.deepStrictEqual(s.readLines(0, 10), []);
  lf.close(s.id);
});

// ---- pathological long line (minified blob) --------------------------------
const longLine = write('long.txt', Buffer.from('A'.repeat(200 * 1024) + '\nshort\n', 'utf8'));
test('over-long line is truncated, following line still correct', async () => {
  const s = await openIndexed(longLine);
  const rows = s.readLines(0, 2);
  assert.ok(rows[0].length <= lf.MAX_LINE_BYTES + 32, 'first line capped');
  assert.ok(rows[0].includes('…[truncated]'));
  assert.strictEqual(rows[1], 'short');
  lf.close(s.id);
});

// ---- read past EOF is safe -------------------------------------------------
test('reading past EOF returns only available lines', async () => {
  const s = await openIndexed(noNL);
  assert.deepStrictEqual(s.readLines(2, 100), ['gamma']);
  assert.deepStrictEqual(s.readLines(999, 10), []);
  lf.close(s.id);
});

// ---- UTF-16 large file: KNOWN LIMITATION (documented, not a green claim) ----
// The engine splits on the 0x0A byte, which is UTF-8-safe but NOT UTF-16-safe
// (0x0A occurs inside UTF-16 code units), so UTF-16 huge files are garbled.
// Tracked as a FAIL in docs/QA_TESTPLAN.md → fix in src/main/largefile.js.
test('UTF-16 huge-file decoding is a known limitation', { todo: 'largefile splits on 0x0A; UTF-16 unsupported' }, async () => {
  const u16 = write('u16.txt', Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('héllo\nwörld\n', 'utf16le')]));
  const s = await openIndexed(u16);
  const rows = s.readLines(0, 2);
  lf.close(s.id);
  assert.strictEqual(rows[0], 'héllo'); // expected to FAIL today (garbled)
});
