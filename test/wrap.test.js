'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { wrapText, wrapParagraph } = require('../src/renderer/js/wrap');

test('wrapParagraph greedily fills to width', () => {
  assert.strictEqual(wrapParagraph('the quick brown fox', 9), 'the quick\nbrown fox');
});
test('wrapParagraph keeps an over-long word intact', () => {
  assert.strictEqual(wrapParagraph('supercalifragilistic ok', 5), 'supercalifragilistic\nok');
});
test('wrapText preserves paragraph (blank-line) boundaries', () => {
  const input = 'aaa bbb ccc\n\nddd eee fff';
  const out = wrapText(input, 7);
  assert.strictEqual(out, 'aaa bbb\nccc\n\nddd eee\nfff');
});
test('wrapText defaults to width 80 when width invalid', () => {
  const words = Array.from({ length: 30 }, (_, i) => 'w' + i).join(' ');
  const out = wrapText(words, 0);
  out.split('\n').forEach((l) => assert.ok(l.length <= 80));
});
