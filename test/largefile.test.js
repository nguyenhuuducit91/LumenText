'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const lf = require('../src/main/largefile.js');

function tmp(name) {
  return path.join(os.tmpdir(), `stp-lf-${process.pid}-${name}`);
}
async function index(session) {
  await session.buildIndex(() => {});
}

test('basic lines with trailing newline', async () => {
  const f = tmp('basic.txt');
  fs.writeFileSync(f, 'a\nbb\nccc\n');
  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, 3);
  assert.deepStrictEqual(s.readLines(0, 3), ['a', 'bb', 'ccc']);
  assert.deepStrictEqual(s.readLines(1, 2), ['bb', 'ccc']);
  assert.deepStrictEqual(s.readLines(2, 5), ['ccc']); // count clamps at EOF
  lf.close(s.id);
  fs.unlinkSync(f);
});

test('no trailing newline', async () => {
  const f = tmp('nonl.txt');
  fs.writeFileSync(f, 'a\nbb');
  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, 2);
  assert.deepStrictEqual(s.readLines(0, 2), ['a', 'bb']);
  lf.close(s.id);
  fs.unlinkSync(f);
});

test('empty file', async () => {
  const f = tmp('empty.txt');
  fs.writeFileSync(f, '');
  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, 0);
  assert.deepStrictEqual(s.readLines(0, 10), []);
  lf.close(s.id);
  fs.unlinkSync(f);
});

test('UTF-8 multibyte and emoji survive byte-splitting', async () => {
  const f = tmp('utf8.txt');
  const lines = ['café', '中文测试', '😀🚀 emoji', 'plain'];
  fs.writeFileSync(f, lines.join('\n') + '\n');
  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, 4);
  assert.deepStrictEqual(s.readLines(0, 4), lines);
  lf.close(s.id);
  fs.unlinkSync(f);
});

test('checkpoint crossing (>CHECKPOINT_EVERY lines) reads correct lines', async () => {
  const f = tmp('many.txt');
  const N = lf.CHECKPOINT_EVERY * 3 + 123; // force several checkpoints
  const ws = fs.createWriteStream(f);
  for (let i = 0; i < N; i++) ws.write('line-' + i + '\n');
  await new Promise((r) => ws.end(r));

  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, N);

  for (const start of [0, 1, lf.CHECKPOINT_EVERY - 1, lf.CHECKPOINT_EVERY, lf.CHECKPOINT_EVERY * 2 + 50, N - 3]) {
    const got = s.readLines(start, 3);
    const expect = [];
    for (let i = start; i < Math.min(start + 3, N); i++) expect.push('line-' + i);
    assert.deepStrictEqual(got, expect, `readLines(${start},3)`);
  }
  lf.close(s.id);
  fs.unlinkSync(f);
});

test('over-long line is truncated, following lines still correct', async () => {
  const f = tmp('long.txt');
  const huge = 'x'.repeat(lf.MAX_LINE_BYTES + 5000);
  fs.writeFileSync(f, huge + '\nafter\n');
  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, 2);
  const [l0, l1] = s.readLines(0, 2);
  assert.ok(l0.endsWith('…[truncated]'), 'long line marked truncated');
  assert.ok(l0.length <= lf.MAX_LINE_BYTES + 20, 'long line actually shortened');
  assert.strictEqual(l1, 'after');
  lf.close(s.id);
  fs.unlinkSync(f);
});

test('windows CRLF line endings preserved except the LF split', async () => {
  const f = tmp('crlf.txt');
  fs.writeFileSync(f, 'one\r\ntwo\r\n');
  const s = lf.open(f);
  await index(s);
  assert.strictEqual(s.lineCount, 2);
  // \r remains at end of each line (viewer trims for display); engine is faithful.
  assert.deepStrictEqual(s.readLines(0, 2), ['one\r', 'two\r']);
  lf.close(s.id);
  fs.unlinkSync(f);
});
