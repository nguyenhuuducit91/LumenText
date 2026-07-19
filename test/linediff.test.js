'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { diffHunks, hunkAnchor } = require('../src/shared/linediff.js');

const L = (s) => s.split('\n');

test('no change → no hunks', () => {
  const { hunks } = diffHunks(L('a\nb\nc'), L('a\nb\nc'));
  assert.deepStrictEqual(hunks, []);
});

test('pure add: a line inserted', () => {
  const { hunks } = diffHunks(L('a\nc'), L('a\nb\nc'));
  assert.strictEqual(hunks.length, 1);
  const h = hunks[0];
  assert.strictEqual(h.kind, 'add');
  assert.strictEqual(h.bStart, 2);
  assert.strictEqual(h.bEnd, 2);
  assert.deepStrictEqual(h.head, []); // nothing was there in HEAD
});

test('pure delete: a line removed', () => {
  const { hunks } = diffHunks(L('a\nb\nc'), L('a\nc'));
  assert.strictEqual(hunks.length, 1);
  const h = hunks[0];
  assert.strictEqual(h.kind, 'del');
  assert.ok(h.bEnd < h.bStart, 'pure deletion has bEnd < bStart');
  assert.deepStrictEqual(h.head, ['b']); // the removed HEAD line, for revert
  assert.strictEqual(hunkAnchor(h), 1);  // shows on the line above the deletion
});

test('modification: line changed in place', () => {
  const { hunks } = diffHunks(L('a\nb\nc'), L('a\nB\nc'));
  assert.strictEqual(hunks.length, 1);
  const h = hunks[0];
  assert.strictEqual(h.kind, 'mod');
  assert.strictEqual(h.bStart, 2);
  assert.strictEqual(h.bEnd, 2);
  assert.deepStrictEqual(h.head, ['b']);
});

test('multiple separate hunks', () => {
  const { hunks } = diffHunks(L('a\nb\nc\nd\ne'), L('A\nb\nc\nD\ne'));
  assert.strictEqual(hunks.length, 2);
  assert.strictEqual(hunks[0].bStart, 1);
  assert.strictEqual(hunks[1].bStart, 4);
});

test('add at end of file', () => {
  const { hunks } = diffHunks(L('a\nb'), L('a\nb\nc\nd'));
  assert.strictEqual(hunks.length, 1);
  assert.strictEqual(hunks[0].kind, 'add');
  assert.strictEqual(hunks[0].bStart, 3);
  assert.strictEqual(hunks[0].bEnd, 4);
});

test('delete at start of file anchors to line 1', () => {
  const { hunks } = diffHunks(L('x\na\nb'), L('a\nb'));
  assert.strictEqual(hunks[0].kind, 'del');
  assert.strictEqual(hunkAnchor(hunks[0]), 1);
  assert.deepStrictEqual(hunks[0].head, ['x']);
});

test('replace N lines with fewer (net deletion) is a mod hunk carrying all HEAD lines', () => {
  const { hunks } = diffHunks(L('a\nb\nc\nd'), L('a\nX\nd'));
  assert.strictEqual(hunks.length, 1);
  assert.strictEqual(hunks[0].kind, 'mod');
  assert.deepStrictEqual(hunks[0].head, ['b', 'c']); // both replaced lines preserved for revert
});

test('empty buffer vs non-empty head', () => {
  const { hunks } = diffHunks(L('a\nb'), ['']);
  assert.strictEqual(hunks.length, 1);
  // reverting must restore both HEAD lines
  assert.deepStrictEqual(hunks[0].head, ['a', 'b']);
});

test('over the line cap → skipped, no hunks', () => {
  const big = Array.from({ length: 10 }, (_, i) => 'l' + i);
  const { hunks, skipped } = diffHunks(big, big.concat('x'), 5);
  assert.strictEqual(skipped, true);
  assert.deepStrictEqual(hunks, []);
});

// Revert simulation: applying a hunk's head back over its buffer span must
// reproduce the HEAD text — this is the property revert-hunk relies on.
test('applying every hunk in reverse order reconstructs HEAD', () => {
  const head = L('one\ntwo\nthree\nfour\nfive');
  const buf = L('one\nTWO\nthree\ninserted\nfive');
  const { hunks } = diffHunks(head, buf);
  const lines = buf.slice();
  // apply from the bottom up so earlier indices stay valid
  for (const h of hunks.slice().sort((a, b) => b.bStart - a.bStart)) {
    if (h.bEnd >= h.bStart) lines.splice(h.bStart - 1, h.bEnd - h.bStart + 1, ...h.head);
    else lines.splice(h.bStart - 1, 0, ...h.head);
  }
  assert.deepStrictEqual(lines, head);
});
